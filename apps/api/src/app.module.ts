import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { parseEnvironment } from '@streamos/config';
import { PrismaClient } from '@streamos/database';
import Redis from 'ioredis';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AuthController } from './identity/auth.controller';
import { AuthService } from './identity/auth.service';
import { MailerService } from './identity/mailer.service';
import { PaymentsController } from './payments/payments.controller';
import { PaymentsService } from './payments/payments.service';
import {
  MockPaymentProvider,
  PAYMENT_PROVIDER,
} from './payments/payment-provider';
import { WooviPaymentProvider } from './payments/woovi-payment-provider';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { SupportController } from './support/support.controller';
import { SupportService } from './support/support.service';
import { WidgetsController } from './widgets/widgets.controller';
import { WidgetsService } from './widgets/widgets.service';
import { LiveControlController } from './live-control/live-control.controller';
import { LiveControlService } from './live-control/live-control.service';
import { AlertsController } from './alerts/alerts.controller';
import { AlertsService } from './alerts/alerts.service';
import { PermissionGuard } from './authorization/permission.guard';
import { SongPixController } from './songpix/songpix.controller';
import { SongPixService } from './songpix/songpix.service';
import { VideoPixController } from './videopix/videopix.controller';
import { VideoPixService } from './videopix/videopix.service';
import { ModerationController } from './moderation/moderation.controller';
import { ModerationService } from './moderation/moderation.service';
import { CampaignsController } from './campaigns/campaigns.controller';
import { CampaignsService } from './campaigns/campaigns.service';
import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { PlatformController } from './platform/platform.controller';
import { PlatformService } from './platform/platform.service';
import { PublicRateLimitGuard } from './security/public-rate-limit.guard';
import { MetricsController } from './observability/metrics.controller';
import { TtsController } from './tts/tts.controller';
import { TtsService } from './tts/tts.service';

const environment = parseEnvironment(process.env);

@Module({
  controllers: [
    AuthController,
    DashboardController,
    HealthController,
    PaymentsController,
    SupportController,
    WidgetsController,
    LiveControlController,
    AlertsController,
    SongPixController,
    VideoPixController,
    ModerationController,
    CampaignsController,
    SubscriptionsController,
    PlatformController,
    MetricsController,
    TtsController,
  ],
  providers: [
    AuthService,
    MailerService,
    DashboardService,
    PaymentsService,
    TtsService,
    MockPaymentProvider,
    WooviPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [MockPaymentProvider, WooviPaymentProvider],
      useFactory: (mock: MockPaymentProvider, woovi: WooviPaymentProvider) =>
        environment.PAYMENT_PROVIDER === 'woovi' ? woovi : mock,
    },
    HealthService,
    SupportService,
    WidgetsService,
    LiveControlService,
    AlertsService,
    { provide: APP_GUARD, useClass: PublicRateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    SongPixService,
    VideoPixService,
    ModerationService,
    CampaignsService,
    SubscriptionsService,
    PlatformService,
    {
      provide: PrismaClient,
      useFactory: () => new PrismaClient(),
    },
    {
      provide: Redis,
      useFactory: () =>
        new Redis(environment.REDIS_URL, {
          enableOfflineQueue: false,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }),
    },
  ],
})
export class AppModule {}
