/**
 * Runs the API on http://localhost:8787 with an in-memory store and the real weather and
 * terrain sources, so the dashboard can be developed without an AWS account.
 */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { MemoryRepository } from '../src/api/repository.ts';
import { routeRequest } from '../src/api/router.ts';
import type { ServiceDependencies } from '../src/api/service.ts';
import { fetchForecast, fetchForecastHistory, fetchReplay, fetchTerrain } from '../src/sources/open-meteo.ts';
import { fetchReservoirs } from '../src/sources/reservoirs.ts';

const PORT = 8787;

const deps: ServiceDependencies = {
  repository: new MemoryRepository(),
  fetchForecast,
  fetchReplay,
  fetchTerrain,
  fetchForecastHistory,
  fetchReservoirs,
  now: () => new Date(),
  newId: () => randomUUID(),
};

createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${String(PORT)}`);
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    };
    if (request.method === 'OPTIONS') {
      response.writeHead(204, headers).end();
      return;
    }
    void routeRequest(deps, {
      method: request.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      ...(chunks.length === 0 ? {} : { body: Buffer.concat(chunks).toString() }),
    }).then((result) => {
      response.writeHead(result.status, headers).end(JSON.stringify(result.body));
    });
  });
}).listen(PORT, () => {
  console.log(`Vellam API on http://localhost:${String(PORT)}`);
});
