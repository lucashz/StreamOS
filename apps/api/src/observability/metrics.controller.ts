import {
  Controller,
  Get,
  Headers,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prometheusMetrics } from './http-observability';

export function metricsAuthorizationValid(
  token: string | undefined,
  authorization: string | undefined,
  production = process.env.NODE_ENV === 'production',
) {
  if (!token) return !production;
  if (!authorization?.startsWith('Bearer ')) return false;
  const expected = createHash('sha256').update(`Bearer ${token}`).digest();
  const received = createHash('sha256').update(authorization).digest();
  return timingSafeEqual(expected, received);
}

@Controller('metrics')
export class MetricsController {
  @Get()
  metrics(
    @Headers('authorization') authorization: string | undefined,
    @Res() response: Response,
  ) {
    const token = process.env.METRICS_TOKEN;
    if (!metricsAuthorizationValid(token, authorization))
      throw new UnauthorizedException('Credencial de métricas inválida');
    response.type('text/plain; version=0.0.4').send(prometheusMetrics());
  }
}
