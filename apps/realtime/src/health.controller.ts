import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return { service: 'realtime', status: 'ok' } as const;
  }
}
