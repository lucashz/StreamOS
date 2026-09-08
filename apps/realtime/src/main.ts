import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { parseEnvironment } from '@streamos/config';

import { RealtimeModule } from './realtime.module';

async function bootstrap(): Promise<void> {
  parseEnvironment(process.env);
  const app = await NestFactory.create(RealtimeModule);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.REALTIME_PORT ?? 3002));
}

void bootstrap();
