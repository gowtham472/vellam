import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PublishCommand, SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fetchForecast, fetchForecastHistory, fetchReplay, fetchTerrain } from '../sources/open-meteo.ts';
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
    fetchForecastHistory,
    publishAlert: async (subject, message) => {
      // SNS limits an email subject to 100 characters.
      await sns.send(new PublishCommand({ TopicArn: topicArn, Subject: subject.slice(0, 100), Message: message }));
    },
    subscribeToAlerts: async (email) => {
      await sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: 'email', Endpoint: email }));
    },
    ...(pauseMs === undefined ? {} : { pause: () => new Promise<void>((resolve) => setTimeout(resolve, pauseMs)) }),
    now: () => new Date(),
    newId: () => randomUUID(),
  };
}
