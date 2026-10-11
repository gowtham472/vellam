import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ReservoirReport } from '../core/reservoirs.ts';
import type { Assessment, NearestWater, Point, Snapshot, Terrain, Watch, WaterReport } from '../core/types.ts';

/** How long a resident's report stays on the map. Floodwater in a street is news for hours, not days. */
export const REPORT_LIFETIME_HOURS = 48;

const REPORT_CELL_DEGREES = 0.02;

export interface Repository {
  /** Ground heights never change, so they are kept for good and fetched once per place. */
  getTerrain(point: Point): Promise<Terrain | undefined>;
  saveTerrain(point: Point, terrain: Terrain): Promise<void>;
  /** The nearest water found for a place outside Chennai: null when none is within reach, undefined when never looked up. */
  getNearbyWater(point: Point): Promise<NearestWater | null | undefined>;
  saveNearbyWater(point: Point, water: NearestWater | null): Promise<void>;
  /** A live assessment is reused until the next hourly forecast. */
  getAssessment(point: Point, hour: string): Promise<Assessment | undefined>;
  saveAssessment(point: Point, hour: string, assessment: Assessment, now: Date): Promise<void>;
  saveReport(report: WaterReport, now: Date): Promise<void>;
  /** Reports from the cell containing the point and the eight cells around it. */
  reportsNear(point: Point, now: Date): Promise<WaterReport[]>;
  /** `key` is `LIVE` for the current forecast or a date for a replay. */
  getSnapshot(key: string): Promise<Snapshot | undefined>;
  saveSnapshot(key: string, snapshot: Snapshot): Promise<void>;
  saveWatch(watch: Watch): Promise<void>;
  listWatches(limit: number): Promise<Watch[]>;
  /** `key` is `LIVE` for today's bulletin or a date for a past one. */
  getReservoirs(key: string): Promise<ReservoirReport | undefined>;
  /** Today's bulletin is kept for `hours`; a past one never changes and is kept for good. */
  saveReservoirs(key: string, report: ReservoirReport, now: Date, hours?: number): Promise<void>;
}

/** Places are keyed to about 110 m, a little coarser than the 90 m elevation grid. */
export function placeKey(point: Point): string {
  return `${point.lat.toFixed(3)},${point.lon.toFixed(3)}`;
}

function cellIndex(degrees: number): number {
  return Math.floor(degrees / REPORT_CELL_DEGREES);
}

function reportCell(lat: number, lon: number): string {
  return `${String(cellIndex(lat))}:${String(cellIndex(lon))}`;
}

/**
 * The cell a point falls in and its eight neighbours, about six kilometres across in all.
 *
 * Neighbours are found by stepping the whole-number index. Stepping the coordinate by a
 * cell's width and rounding again can land in the same cell twice, because 13.06 / 0.02
 * and 13.08 / 0.02 do not divide exactly; that read one report as two.
 */
export function reportCellsAround(point: Point): string[] {
  const cells: string[] = [];
  for (const dLat of [-1, 0, 1]) {
    for (const dLon of [-1, 0, 1]) {
      cells.push(`${String(cellIndex(point.lat) + dLat)}:${String(cellIndex(point.lon) + dLon)}`);
    }
  }
  return cells;
}

function epochSeconds(date: Date, plusHours: number): number {
  return Math.floor(date.getTime() / 1000) + plusHours * 3600;
}

export class MemoryRepository implements Repository {
  private readonly terrain = new Map<string, Terrain>();
  private readonly water = new Map<string, NearestWater | null>();
  private readonly assessments = new Map<string, Assessment>();
  readonly reports: WaterReport[] = [];
  readonly snapshots = new Map<string, Snapshot>();
  readonly reservoirs = new Map<string, ReservoirReport>();
  readonly watches = new Map<string, Watch>();

  saveWatch(watch: Watch): Promise<void> {
    this.watches.set(watch.key, watch);
    return Promise.resolve();
  }

  listWatches(limit: number): Promise<Watch[]> {
    return Promise.resolve([...this.watches.values()].slice(0, limit));
  }

  getReservoirs(key: string): Promise<ReservoirReport | undefined> {
    return Promise.resolve(this.reservoirs.get(key));
  }

  saveReservoirs(key: string, report: ReservoirReport): Promise<void> {
    this.reservoirs.set(key, report);
    return Promise.resolve();
  }

  getSnapshot(key: string): Promise<Snapshot | undefined> {
    return Promise.resolve(this.snapshots.get(key));
  }

  saveSnapshot(key: string, snapshot: Snapshot): Promise<void> {
    this.snapshots.set(key, snapshot);
    return Promise.resolve();
  }

  getNearbyWater(point: Point): Promise<NearestWater | null | undefined> {
    return Promise.resolve(this.water.get(placeKey(point)));
  }

  saveNearbyWater(point: Point, water: NearestWater | null): Promise<void> {
    this.water.set(placeKey(point), water);
    return Promise.resolve();
  }

  getTerrain(point: Point): Promise<Terrain | undefined> {
    return Promise.resolve(this.terrain.get(placeKey(point)));
  }

  saveTerrain(point: Point, terrain: Terrain): Promise<void> {
    this.terrain.set(placeKey(point), terrain);
    return Promise.resolve();
  }

  getAssessment(point: Point, hour: string): Promise<Assessment | undefined> {
    return Promise.resolve(this.assessments.get(`${placeKey(point)}@${hour}`));
  }

  saveAssessment(point: Point, hour: string, assessment: Assessment): Promise<void> {
    this.assessments.set(`${placeKey(point)}@${hour}`, assessment);
    return Promise.resolve();
  }

  saveReport(report: WaterReport): Promise<void> {
    this.reports.push(report);
    return Promise.resolve();
  }

  reportsNear(point: Point, now: Date): Promise<WaterReport[]> {
    const cells = new Set(reportCellsAround(point));
    const oldest = new Date(now.getTime() - REPORT_LIFETIME_HOURS * 3_600_000).toISOString();
    return Promise.resolve(
      this.reports.filter((report) => cells.has(reportCell(report.point.lat, report.point.lon)) && report.at >= oldest),
    );
  }
}

export class DynamoRepository implements Repository {
  private readonly client: DynamoDBDocumentClient;
  private readonly table: string;

  constructor(client: DynamoDBDocumentClient, table: string) {
    this.client = client;
    this.table = table;
  }

  async getNearbyWater(point: Point): Promise<NearestWater | null | undefined> {
    const item = await this.get('WATER', placeKey(point));
    return item === undefined ? undefined : ((item['water'] as NearestWater | undefined) ?? null);
  }

  async saveNearbyWater(point: Point, water: NearestWater | null): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: { pk: 'WATER', sk: placeKey(point), ...(water === null ? {} : { water }) } }));
  }

  async getTerrain(point: Point): Promise<Terrain | undefined> {
    const item = await this.get('TERRAIN', placeKey(point));
    return item?.['terrain'] as Terrain | undefined;
  }

  async saveTerrain(point: Point, terrain: Terrain): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: { pk: 'TERRAIN', sk: placeKey(point), terrain } }));
  }

  async getAssessment(point: Point, hour: string): Promise<Assessment | undefined> {
    const item = await this.get(`ASSESSMENT#${hour}`, placeKey(point));
    return item?.['assessment'] as Assessment | undefined;
  }

  async saveAssessment(point: Point, hour: string, assessment: Assessment, now: Date): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: { pk: `ASSESSMENT#${hour}`, sk: placeKey(point), assessment, expiresAt: epochSeconds(now, 2) },
      }),
    );
  }

  async saveReport(report: WaterReport, now: Date): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: {
          pk: `REPORT#${reportCell(report.point.lat, report.point.lon)}`,
          sk: `${report.at}#${report.id}`,
          report,
          expiresAt: epochSeconds(now, REPORT_LIFETIME_HOURS),
        },
      }),
    );
  }

  async reportsNear(point: Point, now: Date): Promise<WaterReport[]> {
    // DynamoDB removes expired items within days, not at the moment they expire, so the
    // query also bounds the sort key by time.
    const oldest = new Date(now.getTime() - REPORT_LIFETIME_HOURS * 3_600_000).toISOString();
    const pages = await Promise.all(
      reportCellsAround(point).map((cell) =>
        this.client.send(
          new QueryCommand({
            TableName: this.table,
            KeyConditionExpression: 'pk = :pk AND sk >= :oldest',
            ExpressionAttributeValues: { ':pk': `REPORT#${cell}`, ':oldest': oldest },
            Limit: 200,
          }),
        ),
      ),
    );
    return pages.flatMap((page) => (page.Items ?? []).map((item) => item['report'] as WaterReport));
  }

  async getSnapshot(key: string): Promise<Snapshot | undefined> {
    const item = await this.get('SNAPSHOT', key);
    return item?.['snapshot'] as Snapshot | undefined;
  }

  async saveSnapshot(key: string, snapshot: Snapshot): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: { pk: 'SNAPSHOT', sk: key, snapshot } }));
  }

  async saveWatch(watch: Watch): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.table, Item: { pk: 'WATCH', sk: watch.key, watch } }));
  }

  async listWatches(limit: number): Promise<Watch[]> {
    const page = await this.client.send(
      new QueryCommand({ TableName: this.table, KeyConditionExpression: 'pk = :pk', ExpressionAttributeValues: { ':pk': 'WATCH' }, Limit: limit }),
    );
    return (page.Items ?? []).map((item) => item['watch'] as Watch);
  }

  async getReservoirs(key: string): Promise<ReservoirReport | undefined> {
    const item = await this.get('RESERVOIRS', key);
    // An expired item can outlive its time by days before DynamoDB removes it.
    const expiresAt = item?.['expiresAt'];
    if (typeof expiresAt === 'number' && expiresAt < Date.now() / 1000) return undefined;
    return item?.['report'] as ReservoirReport | undefined;
  }

  async saveReservoirs(key: string, report: ReservoirReport, now: Date, hours?: number): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.table,
        Item: { pk: 'RESERVOIRS', sk: key, report, ...(hours === undefined ? {} : { expiresAt: epochSeconds(now, hours) }) },
      }),
    );
  }

  private async get(pk: string, sk: string): Promise<Record<string, unknown> | undefined> {
    const result = await this.client.send(new GetCommand({ TableName: this.table, Key: { pk, sk } }));
    return result.Item;
  }
}
