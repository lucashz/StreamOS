import 'reflect-metadata';
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { parseEnvironment } from '@streamos/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import { join } from 'node:path';

import { AppModule } from './app.module';
import { httpObservability } from './observability/http-observability';

async function bootstrap(): Promise<void> {
  const environment = parseEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(httpObservability);
  app.use(cookieParser());
  app.use(
    '/uploads',
    express.static(join(process.cwd(), '.runtime', 'uploads'), {
      fallthrough: false,
      maxAge: '1d',
    }),
  );
  app.enableCors({
    origin: [environment.APP_URL, environment.OVERLAY_URL],
    credentials: true,
  });
  const openApi = new DocumentBuilder()
    .setTitle('StreamOS API')
    .setDescription(
      'API da StreamOS para contribuições, overlays, widgets, mídia, carteira e integrações.',
    )
    .setVersion('1.0')
    .addServer(environment.API_URL, 'Ambiente atual')
    .addCookieAuth(
      'streamos_session',
      { type: 'apiKey', in: 'cookie' },
      'session',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'StreamOS API Token' },
      'api-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, openApi);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'StreamOS API',
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 3001));
}

void bootstrap();
