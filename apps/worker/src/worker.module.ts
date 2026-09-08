import { Module } from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import { OutboxWorker } from './outbox.worker';

@Module({ providers: [OutboxWorker, PrismaClient] })
export class WorkerModule {}
