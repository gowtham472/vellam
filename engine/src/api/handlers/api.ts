import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { awsDependencies } from '../dependencies.ts';
import { routeRequest } from '../router.ts';

const deps = awsDependencies();

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const response = await routeRequest(deps, {
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    ...(event.body === undefined ? {} : { body: event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body }),
  });
  return {
    statusCode: response.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(response.body),
  };
}
