import {
  citySnapshot,
  createReport,
  HttpError,
  listPlaces,
  readDate,
  readPoint,
  reportsAround,
  reservoirsFor,
  subscribe,
  trackRecord,
  viewPlace,
  type ServiceDependencies,
} from './service.ts';

export interface ApiRequest {
  readonly method: string;
  readonly path: string;
  readonly query: Record<string, string | undefined>;
  readonly body?: string;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

function parseBody(body: string | undefined): unknown {
  try {
    return JSON.parse(body ?? '');
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON');
  }
}

/** Maps a request to the service and turns failures into responses a browser can show. */
export async function routeRequest(deps: ServiceDependencies, request: ApiRequest): Promise<ApiResponse> {
  try {
    const route = `${request.method} ${request.path}`;
    switch (route) {
      case 'GET /places':
        return { status: 200, body: listPlaces() };
      case 'GET /assess':
        return { status: 200, body: await viewPlace(deps, readPoint(request.query), readDate(request.query['date'])) };
      case 'GET /track-record':
        return { status: 200, body: await trackRecord(deps, readPoint(request.query)) };
      case 'GET /reports':
        return { status: 200, body: await reportsAround(deps, readPoint(request.query)) };
      case 'POST /reports':
        return { status: 201, body: await createReport(deps, parseBody(request.body)) };
      case 'GET /reservoirs':
        return { status: 200, body: await reservoirsFor(deps, readDate(request.query['date'])) };
      case 'GET /city':
        return { status: 200, body: await citySnapshot(deps, readDate(request.query['date'])) };
      case 'POST /alerts':
        return { status: 202, body: await subscribe(deps, parseBody(request.body)) };
      default:
        return { status: 404, body: { message: `No route for ${route}` } };
    }
  } catch (error) {
    if (error instanceof HttpError) return { status: error.status, body: { message: error.message } };
    // Upstream errors can quote URLs and internal names; the caller gets a plain message
    // and the detail goes to the log.
    console.error('Request failed', { path: request.path, error });
    return { status: 502, body: { message: 'Vellam could not reach its weather or terrain source. Try again in a minute.' } };
  }
}
