import { Controller, Get, Inject } from '@nestjs/common';

import { HealthService } from './health.service';

export interface HealthResponse {
  service: 'api';
  status: 'ok';
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService = {} as HealthService,
  ) {}

  @Get('live')
  live(): HealthResponse {
    return { service: 'api', status: 'ok' };
  }

  @Get('ready')
  ready(): Promise<HealthResponse> {
    return this.healthService.checkReadiness();
  }
}
