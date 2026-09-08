import { z } from 'zod';

const environmentBoolean = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return value;
}, z.boolean());

const emptyAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());
const optionalString = z.preprocess(
  emptyAsUndefined,
  z.string().min(1).optional(),
);
const optionalSecret = z.preprocess(
  emptyAsUndefined,
  z.string().min(32).optional(),
);

export const servicePorts = {
  api: 3001,
  overlay: 3003,
  realtime: 3002,
  web: 3000,
} as const;

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z.url().startsWith('postgresql://'),
    REDIS_URL: z.url().startsWith('redis://'),
    APP_URL: z.url(),
    API_URL: z.url(),
    REALTIME_URL: z.string().regex(/^wss?:\/\//),
    OVERLAY_URL: z.url(),
    SESSION_SECRET: z.string().min(32),
    WEBHOOK_MOCK_SECRET: z.string().min(32),
    MAIL_HOST: z.string().min(1),
    MAIL_PORT: z.coerce.number().int().positive(),
    PAYMENT_PROVIDER: z.enum(['mock', 'woovi']).default('mock'),
    WOOVI_BASE_URL: optionalUrl,
    WOOVI_APP_ID: optionalString,
    WOOVI_WEBHOOK_AUTHORIZATION: optionalSecret,
    WOOVI_SOURCE_PIX_KEY: z.preprocess(
      emptyAsUndefined,
      z.string().min(5).optional(),
    ),
    VIDEO_PROVIDER: z.enum(['mock', 'youtube']).default('mock'),
    YOUTUBE_API_KEY: optionalString,
    SONG_CATALOG_PROVIDER: z.enum(['mock', 'http']).default('mock'),
    SONG_CATALOG_BASE_URL: optionalUrl,
    SONG_CATALOG_API_KEY: optionalString,
    APP_ENCRYPTION_KEY: z
      .string()
      .min(32)
      .default('streamos-local-development-encryption-key'),
    METRICS_TOKEN: optionalSecret,
    STREAMOS_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(500),
    PSP_FEE_BPS: z.coerce.number().int().min(0).max(10000).default(80),
    PSP_MINIMUM_FEE_IN_CENTS: z.coerce.number().int().min(0).default(50),
    PSP_MAXIMUM_FEE_IN_CENTS: z.coerce.number().int().min(0).default(500),
    PAYMENTS_ENABLED: environmentBoolean.default(true),
    PAYOUTS_ENABLED: environmentBoolean.default(false),
    VIDEOPIX_ENABLED: environmentBoolean.default(true),
    SONGPIX_ENABLED: environmentBoolean.default(true),
    SUBSCRIPTIONS_ENABLED: environmentBoolean.default(true),
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    ERROR_TRACKING_DSN: optionalUrl,
    DAILY_ACCOUNT_LIMIT_IN_CENTS: z.coerce
      .number()
      .int()
      .positive()
      .default(100000),
    MAX_LIVE_QUEUE_ITEMS: z.coerce
      .number()
      .int()
      .min(10)
      .max(1000)
      .default(200),
  })
  .superRefine((environment, context) => {
    if (
      environment.NODE_ENV === 'production' &&
      environment.APP_ENCRYPTION_KEY ===
        'streamos-local-development-encryption-key'
    )
      context.addIssue({
        code: 'custom',
        path: ['APP_ENCRYPTION_KEY'],
        message: 'Produção exige uma chave de criptografia exclusiva',
      });
    if (environment.PAYMENT_PROVIDER !== 'woovi') return;
    if (!environment.WOOVI_APP_ID)
      context.addIssue({
        code: 'custom',
        path: ['WOOVI_APP_ID'],
        message: 'Obrigatório para Woovi',
      });
    if (!environment.WOOVI_WEBHOOK_AUTHORIZATION)
      context.addIssue({
        code: 'custom',
        path: ['WOOVI_WEBHOOK_AUTHORIZATION'],
        message: 'Obrigatório para Woovi',
      });
    if (environment.PAYOUTS_ENABLED && !environment.WOOVI_SOURCE_PIX_KEY)
      context.addIssue({
        code: 'custom',
        path: ['WOOVI_SOURCE_PIX_KEY'],
        message: 'Obrigatório para Pix Out Woovi',
      });
  });

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(source);
}
