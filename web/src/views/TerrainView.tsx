import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeftIcon, CarProfileIcon, MountainsIcon, NavigationArrowIcon, WavesIcon } from '@phosphor-icons/react';
import { addProtocol, Map as GlMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource, type RasterTileSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { useEffect, useRef, useState } from 'react';
import type { PlaceView as PlaceData } from '../../../engine/src/api/service.ts';
import { distanceMetres } from '../../../engine/src/core/geo.ts';
import type { Point } from '../../../engine/src/core/types.ts';
import { api } from '../api.ts';
import { placeLink } from '../App.tsx';
import { DEPTH_NAME, LEVEL_NAME, useText } from '../i18n.ts';
import { LEVEL } from '../level.ts';

/**
 * A street in three dimensions: real ground heights and buildings, the streets that flooded
 * in 2015, neighbours' reports, and a slider that floods everything below a chosen height.
 *
 * The slider is geometry only. It answers "is my street lower than the ones
 * around it?" and nothing about how deep water will actually get, and the page says so.
 */

// The map engine parses tiles in a worker. A bundler cannot find that file by itself, so it
// is published as an asset and the engine is told where it is.
setWorkerUrl(workerUrl);

/** Height tiles are read at this zoom, where one pixel is about nine metres of ground. */
const TILE_ZOOM = 14;
const TILE_SIZE = 256;
/** The view covers the tile holding the street and the eight around it, about 7 km across. */
const BLOCK = 3;
const SIZE = TILE_SIZE * BLOCK;
/** Chennai is nearly flat, so heights are stretched to make its slopes visible at all. */
const EXAGGERATION = 6;
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const SEARCH_METRES = 1200;
const MIN_WALK_METRES = 150;
const MIN_GAIN_METRES = 2;
const FLOODED_CLEARANCE_PX = 11;
const SPOTS = 3;

interface Ground {
  /** Metres above sea level for each pixel of the block, row by row from the north-west. */
  readonly heights: Float32Array;
  readonly west: number;
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly originX: number;
  readonly originY: number;
}

interface Spot {
  readonly point: Point;
  readonly height: number;
  readonly metres: number;
}

function tileX(lon: number): number {
  return ((lon + 180) / 360) * 2 ** TILE_ZOOM;
}

function tileY(lat: number): number {
  const radians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** TILE_ZOOM;
}

function lonOf(x: number): number {
  return (x / 2 ** TILE_ZOOM) * 360 - 180;
}

function latOf(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** TILE_ZOOM))) * 180) / Math.PI;
}

/** Downloads the nine height tiles around a place and decodes them into metres. */
async function loadGround(point: Point): Promise<Ground> {
  const originX = Math.floor(tileX(point.lon)) - 1;
  const originY = Math.floor(tileY(point.lat)) - 1;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) throw new Error('This browser cannot read the height tiles');
  await Promise.all(
    Array.from({ length: BLOCK * BLOCK }, async (_, i) => {
      const column = i % BLOCK;
      const row = Math.floor(i / BLOCK);
      const url = TERRAIN_TILES.replace('{z}', String(TILE_ZOOM))
        .replace('{x}', String(originX + column))
        .replace('{y}', String(originY + row));
      const response = await fetch(url);
      if (!response.ok) throw new Error('The height data for this area could not be loaded');
      context.drawImage(await createImageBitmap(await response.blob()), column * TILE_SIZE, row * TILE_SIZE);
    }),
  );
  const pixels = context.getImageData(0, 0, SIZE, SIZE).data;
  const heights = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < heights.length; i += 1) {
    // Terrarium encoding: height in metres is red * 256 + green + blue / 256, less 32768.
    heights[i] = (pixels[i * 4] ?? 0) * 256 + (pixels[i * 4 + 1] ?? 0) + (pixels[i * 4 + 2] ?? 0) / 256 - 32768;
  }
  return { heights, west: lonOf(originX), east: lonOf(originX + BLOCK), north: latOf(originY), south: latOf(originY + BLOCK), originX, originY };
}

function pixelOf(ground: Ground, point: Point): [number, number] {
  return [Math.round((tileX(point.lon) - ground.originX) * TILE_SIZE), Math.round((tileY(point.lat) - ground.originY) * TILE_SIZE)];
}

function pointOf(ground: Ground, x: number, y: number): Point {
  return { lon: lonOf(ground.originX + x / TILE_SIZE), lat: latOf(ground.originY + y / TILE_SIZE) };
}

function heightAt(ground: Ground, point: Point): number {
  const [x, y] = pixelOf(ground, point);
  return ground.heights[Math.min(SIZE - 1, Math.max(0, y)) * SIZE + Math.min(SIZE - 1, Math.max(0, x))] ?? 0;
}

/** The share of the block that lies at or below `level`. */
function shareBelow(ground: Ground, level: number | undefined): number {
  if (level === undefined) return 0;
  let covered = 0;
  for (const height of ground.heights) if (height <= level) covered += 1;
  return covered / ground.heights.length;
}

const WATER_SCHEME = 'vellamwater';

/**
 * Draws the water as map tiles, made in the browser. A request for
 * `vellamwater://<level>/<z>/<x>/<y>` loads the height tile for that square and returns a
 * picture with every pixel at or below the level painted blue. Being ordinary tiles, the
 * map drapes them over the terrain and asks for more as the visitor pans, which a single
 * picture laid over the map would not do.
 */
function registerWaterTiles(): void {
  addProtocol(WATER_SCHEME, async (request) => {
    const [level = '0', z = '0', x = '0', y = '0'] = request.url.slice(`${WATER_SCHEME}://`.length).split('/');
    const response = await fetch(TERRAIN_TILES.replace('{z}', z).replace('{x}', x).replace('{y}', y));
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!response.ok || context === null) throw new Error('The height tile could not be read');
    context.drawImage(await createImageBitmap(await response.blob()), 0, 0);
    const image = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    const pixels = image.data;
    const water = Number(level);
    for (let i = 0; i < pixels.length; i += 4) {
      // Terrarium encoding: height in metres is red * 256 + green + blue / 256, less 32768.
      const depth = water - ((pixels[i] ?? 0) * 256 + (pixels[i + 1] ?? 0) + (pixels[i + 2] ?? 0) / 256 - 32768);
      pixels[i] = 28;
      pixels[i + 1] = 110;
      pixels[i + 2] = 214;
      // Deeper water is drawn more solid, up to three metres. Dry ground is left clear.
      pixels[i + 3] = depth < 0 ? 0 : 120 + Math.min(1, depth / 3) * 110;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });
    if (blob === null) throw new Error('The water tile could not be drawn');
    return { data: await blob.arrayBuffer() };
  });
}

registerWaterTiles();

function waterTiles(level: number): string[] {
  return [`${WATER_SCHEME}://${level.toFixed(1)}/{z}/{x}/{y}`];
}

/** Marks every pixel within `radius` pixels of one of the given points. */
function maskAround(points: readonly [number, number][], radius: number): Uint8Array {
  const mask = new Uint8Array(SIZE * SIZE);
  for (const [px, py] of points) {
    for (let y = Math.max(0, py - radius); y <= Math.min(SIZE - 1, py + radius); y += 1) {
      for (let x = Math.max(0, px - radius); x <= Math.min(SIZE - 1, px + radius); x += 1) {
        mask[y * SIZE + x] = 1;
      }
    }
  }
  return mask;
}

/**
 * Ground a vehicle could be moved to: on a mapped road, higher than the street, within
 * walking distance, and clear of streets that flooded in 2015. Heights are averaged over
 * 3 by 3 pixels first, because a single high pixel is usually a rooftop.
 */
function findHigherGround(ground: Ground, home: Point, roads: Uint8Array, flooded: Uint8Array): Spot[] {
  const homeHeight = heightAt(ground, home);
  const candidates: Spot[] = [];
  for (let y = 1; y < SIZE - 1; y += 2) {
    for (let x = 1; x < SIZE - 1; x += 2) {
      const index = y * SIZE + x;
      if (roads[index] !== 1 || flooded[index] === 1) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) sum += ground.heights[index + dy * SIZE + dx] ?? 0;
      const height = sum / 9;
      if (height < homeHeight + MIN_GAIN_METRES) continue;
      const point = pointOf(ground, x, y);
      const metres = distanceMetres(home, point);
      if (metres < MIN_WALK_METRES || metres > SEARCH_METRES) continue;
      candidates.push({ point, height, metres });
    }
  }
  // Prefer the most height gained per metre walked, then keep the picks apart.
  candidates.sort((a, b) => (b.height - homeHeight) / b.metres - (a.height - homeHeight) / a.metres);
  const picked: Spot[] = [];
  for (const candidate of candidates) {
    if (picked.every((spot) => distanceMetres(spot.point, candidate.point) > 300)) picked.push(candidate);
    if (picked.length === SPOTS) break;
  }
  return picked;
}

const EMPTY: Ground = { heights: new Float32Array(1), west: 0, east: 0, north: 0, south: 0, originX: 0, originY: 0 };

function marker(className: string, label: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = label;
  return element;
}

export function TerrainView({ point, date }: { point: Point; date?: string }) {
  const { t, language } = useText();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GlMap | null>(null);
  const [ground, setGround] = useState<Ground>();
  const [data, setData] = useState<PlaceData>();
  const [level, setLevel] = useState<number>();
  const [spots, setSpots] = useState<Spot[]>();
  const [error, setError] = useState<string>();
  /** Set once the map has its water layer, so a level chosen earlier is drawn then. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.assess(point, date).then(setData, () => undefined);
    loadGround(point).then(setGround, (reason: unknown) => {
      setError(reason instanceof Error ? reason.message : String(reason));
    });
    // The view is keyed by place and date, so this runs once per place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (container.current === null || ground === undefined) return;
    const created = new GlMap({
      container: container.current,
      style: STYLE,
      center: [point.lon, point.lat],
      zoom: 15.4,
      pitch: 62,
      bearing: -24,
      maxPitch: 75,
      attributionControl: { compact: true },
    });
    map.current = created;
    created.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

    created.once('load', () => {
      // The base style has layers of its own called water, so these carry a prefix.
      created.addSource('vellam-ground', { type: 'raster-dem', tiles: [TERRAIN_TILES], tileSize: TILE_SIZE, maxzoom: 15, encoding: 'terrarium' });
      created.setTerrain({ source: 'vellam-ground', exaggeration: EXAGGERATION });
      const beneathBuildings = created.getLayer('building-3d') === undefined ? undefined : 'building-3d';
      // Height tiles stop at zoom 14 here, so the water is drawn at that detail and stretched closer in.
      created.addSource('vellam-water', { type: 'raster', tiles: waterTiles(0), tileSize: TILE_SIZE, minzoom: 10, maxzoom: TILE_ZOOM });
      created.addLayer(
        { id: 'vellam-water', type: 'raster', source: 'vellam-water', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'nearest' } },
        beneathBuildings,
      );
      created.addSource('vellam-flooded', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      created.addLayer(
        {
          id: 'vellam-flooded',
          type: 'circle',
          source: 'vellam-flooded',
          paint: { 'circle-radius': 3.2, 'circle-color': '#1c5fd6', 'circle-opacity': 0.9, 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' },
        },
        beneathBuildings,
      );
      new Marker({ element: marker('pin pin-home', '') }).setLngLat([point.lon, point.lat]).addTo(created);
      setReady(true);

      // The 2015 record is large, so it is fetched only when this view opens.
      void import('../../../engine/src/data/chennai-flooded-2015.json').then((record) => {
        const inside = (record.default.points as [number, number][]).filter(
          ([lat, lon]) => lat <= ground.north && lat >= ground.south && lon >= ground.west && lon <= ground.east,
        );
        (created.getSource('vellam-flooded') as GeoJSONSource | undefined)?.setData({
          type: 'FeatureCollection',
          features: inside.map(([lat, lon]) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } })),
        });
        const floodedMask = maskAround(
          inside.map(([lat, lon]) => pixelOf(ground, { lat, lon })),
          FLOODED_CLEARANCE_PX,
        );
        // Roads come from the map's own tiles once they have loaded. Without them no spot
        // is suggested, since a high pixel off the road network is usually a roof.
        created.once('idle', () => {
          const roadPixels: [number, number][] = [];
          for (const feature of created.querySourceFeatures('openmaptiles', { sourceLayer: 'transportation' })) {
            const lines = feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : [];
            for (const line of lines) for (const [lon, lat] of line) if (lon !== undefined && lat !== undefined) roadPixels.push(pixelOf(ground, { lat, lon }));
          }
          setSpots(roadPixels.length === 0 ? [] : findHigherGround(ground, point, maskAround(roadPixels, 2), floodedMask));
        });
      });
    });

    return () => {
      created.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ground]);

  // A new level means a new set of tiles; with the water off, the layer is simply hidden.
  useEffect(() => {
    const target = map.current;
    if (target === null || !ready) return;
    if (level !== undefined) (target.getSource('vellam-water') as RasterTileSource | undefined)?.setTiles(waterTiles(level));
    target.setLayoutProperty('vellam-water', 'visibility', level === undefined ? 'none' : 'visible');
  }, [level, ready]);

  // Markers for higher ground and for neighbours' reports.
  useEffect(() => {
    const target = map.current;
    if (target === null) return;
    const added = [
      ...(spots ?? []).map((spot, index) =>
        new Marker({ element: marker('pin pin-spot', String(index + 1)) }).setLngLat([spot.point.lon, spot.point.lat]).addTo(target),
      ),
      ...(data?.reports ?? [])
        .filter((report) => report.depth !== 'NONE')
        .map((report) =>
          new Marker({ element: marker('pin pin-report', DEPTH_NAME[report.depth].en) })
            .setLngLat([report.point.lon, report.point.lat])
            .addTo(target),
        ),
    ];
    return () => {
      for (const item of added) item.remove();
    };
  }, [spots, data]);

  const here = ground === undefined ? undefined : heightAt(ground, point);
  const lowest = ground === undefined ? 0 : Math.floor(Math.max(0, ground.heights.reduce((min, h) => Math.min(min, h), Infinity)));
  const look = data === undefined ? undefined : LEVEL[data.assessment.level];

  return (
    <div className="stack terrain">
      <a className="back" href={placeLink(point.lat, point.lon, date)}>
        <ArrowLeftIcon weight="bold" aria-hidden="true" /> {t('backToAnswer')}
      </a>
      <header className="page-head">
        <div>
          <h1>{t('terrainTitle')}</h1>
          <p className="lead">{t('terrainIntro')}</p>
        </div>
        {data !== undefined && look !== undefined && (
          <span className="pill" style={{ background: look.colour }}>
            {LEVEL_NAME[data.assessment.level][language]}
          </span>
        )}
      </header>

      {error !== undefined && <p className="notice notice-error">{error}</p>}

      <div className="terrain-stage">
        <div ref={container} className="terrain-map" role="application" aria-label="Three dimensional map" />
        <ul className="terrain-key">
          <li>
            <i className="key-home" /> {t('keyHome')}
          </li>
          <li>
            <i className="key-flooded" /> {t('keyFlooded')}
          </li>
          <li>
            <i className="key-water" /> {t('keyWater')}
          </li>
        </ul>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>
            <WavesIcon weight="fill" aria-hidden="true" /> {t('raiseWater')}
          </h2>
          <span className="muted">{level === undefined ? t('waterOff') : `${level.toFixed(1)} m`}</span>
        </div>
        <input
          className="terrain-slider"
          type="range"
          min={lowest}
          max={lowest + 25}
          step={0.5}
          value={level ?? lowest}
          disabled={ground === undefined}
          aria-label={t('raiseWater')}
          onChange={(event) => {
            const value = Number(event.target.value);
            setLevel(value <= lowest ? undefined : value);
          }}
        />
        {level !== undefined && here !== undefined && (
          <p className="terrain-readout">
            {here > level
              ? `${t('spotDry')} ${(here - level).toFixed(1)} m.`
              : `${t('spotUnder')} ${(level - here).toFixed(1)} m.`}{' '}
            {Math.round(shareBelow(ground ?? EMPTY, level) * 100)}% {t('shareUnder')}
          </p>
        )}
        <p className="notice notice-warn">{t('waterCaveat')}</p>
        <dl className="facts">
          <div>
            <MountainsIcon weight="duotone" aria-hidden="true" />
            <dt>{t('groundHeight')}</dt>
            <dd>{here === undefined ? '…' : `${here.toFixed(1)} m`}</dd>
          </div>
          <div>
            <MountainsIcon weight="duotone" aria-hidden="true" />
            <dt>{t('stretch')}</dt>
            <dd>{EXAGGERATION}×</dd>
          </div>
        </dl>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>
            <CarProfileIcon weight="fill" aria-hidden="true" /> {t('higherTitle')}
          </h2>
        </div>
        <p className="muted">{t('higherIntro')}</p>
        {spots === undefined ? (
          <p className="muted">{t('loading')}…</p>
        ) : spots.length === 0 ? (
          <p className="muted">{t('higherNone')}</p>
        ) : (
          <ol className="spots">
            {spots.map((spot, index) => (
              <li key={`${String(spot.point.lat)},${String(spot.point.lon)}`}>
                <span className="spot-number">{index + 1}</span>
                <span>
                  <strong>
                    {Math.round(spot.metres)} m {t('away')}
                  </strong>
                  <small>
                    {spot.height.toFixed(1)} m, {(spot.height - (here ?? 0)).toFixed(1)} m {t('higher')}
                  </small>
                </span>
                <a
                  className="button button-outline"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${spot.point.lat.toFixed(5)},${spot.point.lon.toFixed(5)}&travelmode=driving`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <NavigationArrowIcon weight="fill" aria-hidden="true" /> {t('directions')}
                </a>
              </li>
            ))}
          </ol>
        )}
        <p className="notice notice-warn">{t('higherCaveat')}</p>
      </section>
    </div>
  );
}
