import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fetchForecast, fetchForecastHistory, fetchReplay, fetchTerrain } from '../sources/open-meteo.ts';
import { fetchNearbyWater } from '../sources/overpass.ts';
import { fetchReservoirs } from '../sources/reservoirs.ts';
import { DynamoRepository } from './repository.ts';
import type { ServiceDependencies } from './service.ts';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  return value;
}

/** The dependencies both Lambda functions run with: DynamoDB, SNS and the live sources. */
export function awsDependencies(options: { pauseMs?: number } = {}): ServiceDependencies {
  const sns = new SNSClient({});
  const topicArn = requiredEnv('ALERT_TOPIC_ARN');
  const pauseMs = options.pauseMs;
  return {
    repository: new DynamoRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), requiredEnv('TABLE_NAME')),
    fetchForecast,
    fetchReplay,
    fetchTerrain,
  fetchNearbyWater,
    fetchForecastHistory,
    fetchReservoirs,
    publishAlert: async (topic, subject, message) => {
      await sns.send(
        new PublishCommand({
          TopicArn: topicArn,
          // SNS limits an email subject to 100 characters.
          Subject: subject.slice(0, 100),
          Message: message,
          MessageAttributes: { place: { DataType: 'String', StringValue: topic } },
        }),
      );
    },
    // One SNS topic carries every alert. Each subscription filters on the `place`
    // attribute, so an address receives city alerts and its own street's, nobody else's.
    subscribeToAlerts: async (email, streetKey) => {
      try {
        await sns.send(
          new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: 'email',
            Endpoint: email,
            Attributes: { FilterPolicy: JSON.stringify({ place: streetKey === undefined ? ['CITY'] : ['CITY', streetKey] }) },
          }),
        );
        return true;
      } catch (error) {
        // SNS refuses a second subscription for the same address with a different filter.
        if (error instanceof Error && error.name === 'InvalidParameterException') return false;
        throw error;
      }
    },
    ...(pauseMs === undefined ? {} : { pause: () => new Promise<void>((resolve) => setTimeout(resolve, pauseMs)) }),
    now: () => new Date(),
    newId: () => randomUUID(),
  };
}
