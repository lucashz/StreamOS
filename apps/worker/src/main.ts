import 'reflect-metadata';
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { parseEnvironment } from '@streamos/config';

import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  parseEnvironment(process.env);
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log('Worker ready', 'Bootstrap');
}

void bootstrap();
