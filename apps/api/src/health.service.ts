import {
  Inject,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaClient } from '@streamos/database';
import Redis from 'ioredis';

import type { HealthResponse } from './health.controller';

@Injectable()
export class HealthService implements OnApplicationShutdown {
  constructor(
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
    @Inject(Redis) private readonly redis: Redis,
  ) {}

  async checkReadiness(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      await this.redis.ping();
      return { service: 'api', status: 'ok' };
    } catch (error: unknown) {
      throw new ServiceUnavailableException('Dependencies are not ready', {
        cause: error,
      });
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.$disconnect();
    if (this.redis.status !== 'end') {
      this.redis.disconnect();
    }
  }
}
