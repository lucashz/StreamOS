import { Module } from '@nestjs/common';
import { PrismaClient } from '@streamos/database';

import { RealtimeGateway } from './realtime.gateway';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [RealtimeGateway, PrismaClient],
})
export class RealtimeModule {}
