import { describe, expect, it } from 'vitest';
import { MemoryRepository } from '../engine/src/api/repository.ts';
import { routeRequest } from '../engine/src/api/router.ts';
import type { ServiceDependencies } from '../engine/src/api/service.ts';
import { photoVerdict, reportFloor, type NearbyReport } from '../engine/src/core/reports.ts';
import type { PhotoCheck, WaterReport } from '../engine/src/core/types.ts';
import { parsePhotoJudgement, type PhotoJudgement } from '../engine/src/sources/clef.ts';

// Written from the model's published output schema, not captured from a live call.
const ANSWERS = {
  water: { type: 'noul', noul: 0.94 },
  depth: { type: 'choice', choice: 'KNEE', probabilities: { NONE: 0.01, ANKLE: 0.2, KNEE: 0.7, WAIST: 0.09 }, confidence: 0.6 },
};

describe('parsePhotoJudgement', () => {
  it('reads the two answers, wrapped in a result or not', () => {
    const expected = { waterProbability: 0.94, depth: 'KNEE' };
    expect(parsePhotoJudgement({ model: 'clef-flash', answers: ANSWERS, usage: { input_tokens: 700, output_tokens: 0 } })).toEqual(expected);
    expect(parsePhotoJudgement({ success: true, result: { model: 'clef-flash', answers: ANSWERS } })).toEqual(expected);
  });

  it('refuses an answer that is missing, out of range, or names an unknown depth', () => {
    expect(() => parsePhotoJudgement({ success: false, errors: [{ message: 'Authentication error' }] })).toThrow(/unexpected shape/);
    expect(() => parsePhotoJudgement({ answers: { ...ANSWERS, water: { type: 'noul', noul: 1.4 } } })).toThrow(/unexpected shape/);
    expect(() => parsePhotoJudgement({ answers: { ...ANSWERS, depth: { type: 'choice', choice: 'CHEST' } } })).toThrow(/unexpected shape/);
  });
});

describe('a photo sent with a report', () => {
  const photo = (waterProbability: number, depth: PhotoCheck['depth']): PhotoCheck => ({ verdict: photoVerdict(waterProbability), waterProbability, depth });
  const report = (depth: NearbyReport['depth'], check?: PhotoCheck): NearbyReport => ({ depth, distanceMetres: 80, hoursAgo: 1, ...(check === undefined ? {} : { photo: check }) });

  it('is trusted only when the model is sure either way', () => {
    expect(photoVerdict(0.8)).toBe('SHOWS_WATER');
    expect(photoVerdict(0.79)).toBe('UNCLEAR');
    expect(photoVerdict(0.21)).toBe('UNCLEAR');
    expect(photoVerdict(0.2)).toBe('NO_WATER');
  });

  it('lets one report reach high when the photo shows the depth it claims', () => {
    const floor = reportFloor([report('KNEE', photo(0.93, 'KNEE'))]);
    expect(floor?.level).toBe('HIGH');
    expect(floor?.evidence.statement).toContain('judged by a model to show water knee deep or more');
  });

  it('never lets one report reach severe, whatever the photo shows', () => {
    expect(reportFloor([report('WAIST', photo(0.99, 'WAIST'))])?.level).toBe('HIGH');
  });

  it('leaves a report at watch when the photo is unclear or shows shallower water than claimed', () => {
    expect(reportFloor([report('WAIST', photo(0.5, 'WAIST'))])?.level).toBe('WATCH');
    expect(reportFloor([report('WAIST', photo(0.95, 'ANKLE'))])?.level).toBe('WATCH');
  });

  it('sets aside a report whose photo shows no water', () => {
    expect(reportFloor([report('WAIST', photo(0.05, 'NONE'))])).toBeUndefined();
    expect(reportFloor([report('KNEE', photo(0.05, 'NONE')), report('KNEE')])?.level).toBe('WATCH');
  });
});

describe('POST /reports with a photo', () => {
  const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  function dependencies(judgePhoto?: () => Promise<PhotoJudgement>): ServiceDependencies & { seen: string[] } {
    const seen: string[] = [];
    return {
      seen,
      repository: new MemoryRepository(),
      fetchForecast: () => Promise.reject(new Error('not used')),
      fetchReplay: () => Promise.reject(new Error('not used')),
      fetchTerrain: () => Promise.reject(new Error('not used')),
      fetchForecastHistory: () => Promise.resolve([]),
      fetchReservoirs: () => Promise.reject(new Error('not used')),
      now: () => new Date('2026-10-11T08:00:00Z'),
      newId: () => 'report-1',
      ...(judgePhoto === undefined
        ? {}
        : {
            judgePhoto: (sent) => {
              seen.push(`${sent.contentType} ${sent.base64}`);
              return judgePhoto();
            },
          }),
    };
  }

  const send = (deps: ServiceDependencies, body: unknown) =>
    routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify(body) });
  const at = { lat: 13.0, lon: 80.2, depth: 'KNEE' };

  it('stores the verdict with the report and none of the photo', async () => {
    const deps = dependencies(() => Promise.resolve({ waterProbability: 0.91, depth: 'KNEE' }));
    const response = await send(deps, { ...at, photo: PHOTO });
    expect(response.status).toBe(201);
    expect(deps.seen).toEqual(['image/jpeg /9j/4AAQSkZJRg==']);
    expect((response.body as WaterReport).photo).toEqual({ verdict: 'SHOWS_WATER', waterProbability: 0.91, depth: 'KNEE' });
    expect(JSON.stringify(response.body)).not.toContain('/9j/');
  });

  it('keeps the report without a verdict when the check fails or is not configured', async () => {
    const failing = await send(dependencies(() => Promise.reject(new Error('The photo check failed (429)'))), { ...at, photo: PHOTO });
    expect(failing.status).toBe(201);
    expect((failing.body as WaterReport).photo).toBeUndefined();
    const absent = await send(dependencies(), { ...at, photo: PHOTO });
    expect((absent.body as WaterReport).photo).toBeUndefined();
  });

  it('rejects something that is not an image, and one that is too large', async () => {
    const deps = dependencies(() => Promise.resolve({ waterProbability: 0.9, depth: 'KNEE' }));
    expect((await send(deps, { ...at, photo: 'https://example.com/flood.jpg' })).status).toBe(400);
    expect((await send(deps, { ...at, photo: `data:image/jpeg;base64,${'A'.repeat(2_000_001)}` })).status).toBe(413);
    expect(deps.seen).toEqual([]);
  });
});
