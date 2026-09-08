import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';

export function publicRateLimitFor(method: string, route: string) {
  if (/\/auth\/(login|register|forgot-password|reset-password)/.test(route))
    return 10;
  if (route.startsWith('/mock/') || route.startsWith('/webhooks/')) return 30;
  if (route.startsWith('/public/') && method !== 'GET') return 30;
  if (route.startsWith('/public/')) return 240;
  return 0;
}

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(PublicRateLimitGuard.name);

  constructor(@Inject(Redis) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const route = `${request.baseUrl}${request.path}`.replace(
      /\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,
      '/:id',
    );
    const baseLimit = publicRateLimitFor(request.method, route);
    if (!baseLimit) return true;
    const limit =
      process.env.NODE_ENV === 'production' ? baseLimit : baseLimit * 20;
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      const identity = createHash('sha256')
        .update(request.ip || request.socket.remoteAddress || 'unknown')
        .digest('hex')
        .slice(0, 20);
      const routeHash = createHash('sha256')
        .update(route)
        .digest('hex')
        .slice(0, 16);
      const increment = (key: string) =>
        this.redis.eval(
          "local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('expire',KEYS[1],ARGV[1]) end; return n",
          1,
          key,
          60,
        );
      const body = (request as unknown as { body?: unknown }).body;
      const fields =
        body && typeof body === 'object'
          ? (body as Record<string, unknown>)
          : {};
      const supporter =
        typeof fields.supporterEmail === 'string'
          ? fields.supporterEmail
          : typeof fields.supporterName === 'string'
            ? fields.supporterName
            : undefined;
      const targetIdentity = createHash('sha256')
        .update(request.path)
        .digest('hex')
        .slice(0, 20);
      const supporterIdentity =
        typeof supporter === 'string'
          ? createHash('sha256')
              .update(supporter.trim().toLowerCase())
              .digest('hex')
              .slice(0, 20)
          : null;
      const counts = await Promise.all([
        increment(`streamos:rate:ip:${routeHash}:${identity}`),
        increment(`streamos:rate:target:${routeHash}:${targetIdentity}`),
        supporterIdentity
          ? increment(
              `streamos:rate:supporter:${routeHash}:${supporterIdentity}`,
            )
          : Promise.resolve(0),
      ]);
      const ipCount = Number(counts[0] ?? 0);
      const targetCount = Number(counts[1] ?? 0);
      const supporterCount = Number(counts[2] ?? 0);
      response.setHeader('x-ratelimit-limit', limit);
      response.setHeader('x-ratelimit-remaining', Math.max(0, limit - ipCount));
      if (
        ipCount > limit ||
        targetCount > limit * 10 ||
        supporterCount > Math.max(10, Math.floor(limit / 2))
      )
        throw new HttpException(
          'Muitas tentativas. Aguarde um minuto.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'Redis indisponível; rota pública bloqueada por segurança',
        );
        throw new HttpException(
          'Serviço temporariamente indisponível',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.warn('Redis indisponível; fail-open apenas fora de produção');
      return true;
    }
  }
}
