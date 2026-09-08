import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@streamos/database';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { validAlertRange } from './alert-variation.policy';

export type AlertVariationInput = {
  name: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  minimumInCents: number | null;
  maximumInCents: number | null;
  template: string;
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  textAlign: string;
  layout: Record<string, unknown>;
  minimumDurationMs: number;
  maximumDurationMs: number;
  soundVolume: number;
  ttsEnabled: boolean;
  ttsVoice: string;
  ttsRate: number;
  ttsVolume: number;
  showSupporter: boolean;
  showAmount: boolean;
  showMessage: boolean;
  visualAssetId?: string | null;
  soundAssetId?: string | null;
};

export type GlobalAppearanceInput = {
  template: string;
  accent: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  textAlign: string;
  position: string;
  applyToExisting?: boolean;
};

type Actor = { organizationId: string; userId: string };

@Injectable()
export class AlertsService {
  constructor(@Inject(PrismaClient) private readonly prisma: PrismaClient) {}

  async editor(organizationId: string) {
    const config = await this.ensureConfig(organizationId);
    await this.ensureDefault(organizationId, config.id);
    const [variations, assets] = await Promise.all([
      this.prisma.alertVariation.findMany({
        where: { organizationId, deletedAt: null },
        include: { visualAsset: true, soundAsset: true },
        orderBy: [
          { isDefault: 'desc' },
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.alertMediaAsset.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return this.serialize({ config, variations, assets });
  }

  async appearance(organizationId: string) {
    const config = await this.ensureConfig(organizationId);
    return this.serialize({
      theme: this.normalizedTheme(config.theme),
      updatedAt: config.updatedAt,
    });
  }

  async updateEnabled(actor: Actor, enabled: boolean) {
    if (typeof enabled !== 'boolean')
      throw new BadRequestException('Estado dos alertas inválido');
    const config = await this.ensureConfig(actor.organizationId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const value = await tx.alertConfig.update({
        where: { id: config.id },
        data: { enabled },
      });
      await tx.widget.updateMany({
        where: {
          organizationId: actor.organizationId,
          type: 'ALERT',
          deletedAt: null,
        },
        data: { enabled },
      });
      return value;
    });
    await this.audit(actor, 'alert.config.enabled', config.id, { enabled });
    await this.notifyConfiguration(actor.organizationId);
    return { enabled: updated.enabled, updatedAt: updated.updatedAt };
  }

  async updateAppearance(actor: Actor, input: GlobalAppearanceInput) {
    const theme = this.validateTheme(input);
    const config = await this.ensureConfig(actor.organizationId);
    await this.prisma.$transaction(async (tx) => {
      await tx.alertConfig.update({
        where: { id: config.id },
        data: { theme },
      });
      if (input.applyToExisting) {
        await tx.alertVariation.updateMany({
          where: { organizationId: actor.organizationId, deletedAt: null },
          data: {
            template: theme.template,
            accent: theme.accent,
            textColor: theme.textColor,
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize,
            textAlign: theme.textAlign,
            layout: {
              direction: 'column',
              position: theme.position,
              mediaFit: 'contain',
            },
            configVersion: { increment: 1 },
          },
        });
      }
    });
    await this.audit(actor, 'alert.appearance.update', config.id, {
      applyToExisting: Boolean(input.applyToExisting),
    });
    await this.notifyConfiguration(actor.organizationId);
    return { theme, appliedToExisting: Boolean(input.applyToExisting) };
  }

  async createVariation(actor: Actor, input: AlertVariationInput) {
    const config = await this.ensureConfig(actor.organizationId);
    const data = await this.validated(actor.organizationId, input);
    if (input.isDefault) await this.clearDefault(actor.organizationId);
    const variation = await this.prisma.alertVariation.create({
      data: {
        organizationId: actor.organizationId,
        alertConfigId: config.id,
        ...data,
      },
      include: { visualAsset: true, soundAsset: true },
    });
    await this.audit(actor, 'alert.variation.create', variation.id, {
      name: variation.name,
    });
    await this.notifyConfiguration(actor.organizationId, variation.id);
    return this.serialize(variation);
  }

  async updateVariation(actor: Actor, id: string, input: AlertVariationInput) {
    const current = await this.ownedVariation(actor.organizationId, id);
    const data = await this.validated(actor.organizationId, input);
    if (input.isDefault) await this.clearDefault(actor.organizationId, id);
    if (current.isDefault && !input.isDefault) {
      const other = await this.prisma.alertVariation.count({
        where: {
          organizationId: actor.organizationId,
          deletedAt: null,
          isDefault: true,
          id: { not: id },
        },
      });
      if (!other)
        throw new BadRequestException(
          'O editor precisa de uma variação padrão',
        );
    }
    const variation = await this.prisma.alertVariation.update({
      where: { id },
      data: { ...data, configVersion: { increment: 1 } },
      include: { visualAsset: true, soundAsset: true },
    });
    await this.audit(actor, 'alert.variation.update', id, {
      fromVersion: current.configVersion,
      toVersion: variation.configVersion,
    });
    await this.notifyConfiguration(actor.organizationId, variation.id);
    return this.serialize(variation);
  }

  private async notifyConfiguration(
    organizationId: string,
    variationId?: string,
  ) {
    await this.prisma.outboxEvent.create({
      data: {
        organizationId,
        eventType: 'alert.configuration.updated.v1',
        eventVersion: 1,
        aggregateId: variationId ?? organizationId,
        correlationId: randomUUID(),
        payload: {
          amountInCents: '0',
          ...(variationId ? { targetVariationId: variationId } : {}),
        },
        occurredAt: new Date(),
      },
    });
  }

  async duplicate(actor: Actor, id: string) {
    const source = await this.ownedVariation(actor.organizationId, id);
    const copy = await this.prisma.alertVariation.create({
      data: {
        organizationId: source.organizationId,
        alertConfigId: source.alertConfigId,
        name: `${source.name} — cópia`.slice(0, 80),
        enabled: false,
        isDefault: false,
        priority: source.priority,
        minimumInCents: source.minimumInCents,
        maximumInCents: source.maximumInCents,
        template: source.template,
        accent: source.accent,
        textColor: source.textColor,
        fontFamily: source.fontFamily,
        fontSize: source.fontSize,
        textAlign: source.textAlign,
        layout: source.layout as Prisma.InputJsonValue,
        minimumDurationMs: source.minimumDurationMs,
        maximumDurationMs: source.maximumDurationMs,
        soundVolume: source.soundVolume,
        ttsEnabled: source.ttsEnabled,
        ttsVoice: source.ttsVoice,
        ttsRate: source.ttsRate,
        ttsVolume: source.ttsVolume,
        showSupporter: source.showSupporter,
        showAmount: source.showAmount,
        showMessage: source.showMessage,
        visualAssetId: source.visualAssetId,
        soundAssetId: source.soundAssetId,
      },
    });
    await this.audit(actor, 'alert.variation.duplicate', copy.id, {
      sourceId: id,
    });
    return this.serialize(copy);
  }

  async remove(actor: Actor, id: string) {
    const variation = await this.ownedVariation(actor.organizationId, id);
    if (variation.isDefault)
      throw new BadRequestException('A variação padrão não pode ser excluída');
    await this.prisma.alertVariation.update({
      where: { id },
      data: { deletedAt: new Date(), enabled: false },
    });
    await this.audit(actor, 'alert.variation.delete', id);
    return { deleted: true };
  }

  async createAsset(
    actor: Actor,
    input: {
      name: string;
      kind: string;
      mimeType: string;
      url: string;
      sizeInBytes: number;
      durationMs?: number;
      width?: number;
      height?: number;
    },
  ) {
    this.validateAsset(input);
    const asset = await this.prisma.alertMediaAsset.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name.trim().slice(0, 80),
        kind: input.kind,
        mimeType: input.mimeType,
        url: input.url,
        sizeInBytes: input.sizeInBytes,
        durationMs: input.durationMs,
        width: input.width,
        height: input.height,
      },
    });
    await this.audit(actor, 'alert.asset.create', asset.id, {
      kind: asset.kind,
      mimeType: asset.mimeType,
      sizeInBytes: asset.sizeInBytes,
    });
    return asset;
  }

  async uploadAsset(
    actor: Actor,
    file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    metadata: {
      name?: string;
      durationMs?: number;
      width?: number;
      height?: number;
    },
  ) {
    const kind =
      file.mimetype === 'image/gif'
        ? 'GIF'
        : file.mimetype.startsWith('image/')
          ? 'IMAGE'
          : file.mimetype.startsWith('video/')
            ? 'VIDEO'
            : file.mimetype.startsWith('audio/')
              ? 'AUDIO'
              : '';
    const extensionByMime: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.webm',
    };
    const extension = extensionByMime[file.mimetype];
    if (
      !kind ||
      !extension ||
      (extname(file.originalname) && !extensionByMime[file.mimetype])
    )
      throw new BadRequestException('Formato de arquivo não permitido');
    const filename = `${randomUUID()}${extension}`;
    const relative = join('alerts', actor.organizationId, filename);
    const target = join(process.cwd(), '.runtime', 'uploads', relative);
    await mkdir(
      join(
        process.cwd(),
        '.runtime',
        'uploads',
        'alerts',
        actor.organizationId,
      ),
      { recursive: true },
    );
    const publicApiUrl =
      process.env.PUBLIC_API_URL ??
      process.env.API_URL ??
      'http://localhost:3001';
    const url = `${publicApiUrl.replace(/\/$/, '')}/uploads/${relative.replaceAll('\\', '/')}`;
    this.validateAsset({
      name: metadata.name || file.originalname,
      kind,
      mimeType: file.mimetype,
      url,
      sizeInBytes: file.size,
      durationMs: metadata.durationMs,
    });
    await writeFile(target, file.buffer, { flag: 'wx' });
    return this.createAsset(actor, {
      name: metadata.name || file.originalname,
      kind,
      mimeType: file.mimetype,
      url,
      sizeInBytes: file.size,
      durationMs: metadata.durationMs,
      width: metadata.width,
      height: metadata.height,
    });
  }

  async removeAsset(actor: Actor, id: string) {
    const asset = await this.prisma.alertMediaAsset.findFirst({
      where: { id, organizationId: actor.organizationId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Mídia não encontrada');
    const used = await this.prisma.alertVariation.count({
      where: {
        organizationId: actor.organizationId,
        deletedAt: null,
        OR: [{ visualAssetId: id }, { soundAssetId: id }],
      },
    });
    if (used)
      throw new BadRequestException(
        'A mídia está sendo usada por uma variação',
      );
    await this.prisma.alertMediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit(actor, 'alert.asset.delete', id);
    return { deleted: true };
  }

  async test(actor: Actor, variationId?: string, sequence = false) {
    if (variationId)
      await this.ownedVariation(actor.organizationId, variationId);
    const profile = await this.prisma.creatorProfile.findUnique({
      where: { organizationId: actor.organizationId },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');
    const event = await this.prisma.outboxEvent.create({
      data: {
        organizationId: actor.organizationId,
        eventType: 'alert.test.v2',
        eventVersion: 2,
        aggregateId: profile.id,
        correlationId: randomUUID(),
        payload: {
          amountInCents: '2000',
          supporterName: 'Teste StreamOS',
          message: sequence
            ? 'Teste da sequência de alertas'
            : 'Esta variação está funcionando!',
          targetVariationId: variationId,
          sequence,
        },
        occurredAt: new Date(),
      },
    });
    return { eventId: event.id, queued: true };
  }

  private async ensureConfig(organizationId: string) {
    return this.prisma.alertConfig.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        minimumInCents: 100,
        durationMs: 8000,
        theme: this.defaultTheme(),
      },
    });
  }
  private async ensureDefault(organizationId: string, alertConfigId: string) {
    const count = await this.prisma.alertVariation.count({
      where: { organizationId, isDefault: true, deletedAt: null },
    });
    if (!count)
      await this.prisma.alertVariation.create({
        data: {
          organizationId,
          alertConfigId,
          name: 'Alerta padrão',
          isDefault: true,
          priority: -1,
          layout: {
            direction: 'column',
            position: 'center',
            mediaFit: 'contain',
          },
        },
      });
  }
  private async clearDefault(organizationId: string, exceptId?: string) {
    await this.prisma.alertVariation.updateMany({
      where: {
        organizationId,
        isDefault: true,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { isDefault: false },
    });
  }
  private async ownedVariation(organizationId: string, id: string) {
    const variation = await this.prisma.alertVariation.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!variation) throw new NotFoundException('Variação não encontrada');
    return variation;
  }
  private async validated(organizationId: string, input: AlertVariationInput) {
    const allowedTemplates = [
      'neon-pulse',
      'card',
      'minimal',
      'video-focus',
      'song-compact',
      'neon',
      'gamer',
      'clean',
      'retro',
    ];
    const allowedPositions = [
      'center',
      'top-center',
      'bottom-center',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'full',
    ];
    const layoutPosition =
      typeof input.layout?.position === 'string'
        ? input.layout.position
        : 'center';
    if (
      !input.name?.trim() ||
      input.name.length > 80 ||
      !Number.isInteger(input.priority) ||
      input.priority < -1000 ||
      input.priority > 1000 ||
      !validAlertRange(input.minimumInCents, input.maximumInCents) ||
      !/^#[0-9a-f]{6}$/i.test(input.accent) ||
      !/^#[0-9a-f]{6}$/i.test(input.textColor) ||
      !allowedTemplates.includes(input.template) ||
      !allowedPositions.includes(layoutPosition) ||
      !['left', 'center', 'right'].includes(input.textAlign) ||
      !Number.isInteger(input.fontSize) ||
      input.fontSize < 12 ||
      input.fontSize > 96 ||
      !Number.isInteger(input.minimumDurationMs) ||
      !Number.isInteger(input.maximumDurationMs) ||
      input.minimumDurationMs < 2000 ||
      input.maximumDurationMs > 120000 ||
      input.minimumDurationMs > input.maximumDurationMs ||
      !Number.isInteger(input.soundVolume) ||
      input.soundVolume < 0 ||
      input.soundVolume > 100 ||
      input.ttsRate < 0.5 ||
      input.ttsRate > 2 ||
      !Number.isInteger(input.ttsVolume) ||
      input.ttsVolume < 0 ||
      input.ttsVolume > 100
    )
      throw new BadRequestException('Configuração da variação inválida');
    const ids = [input.visualAssetId, input.soundAssetId].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.length) {
      const assets = await this.prisma.alertMediaAsset.findMany({
        where: { organizationId, id: { in: ids }, deletedAt: null },
      });
      if (assets.length !== new Set(ids).size)
        throw new BadRequestException('Mídia inválida ou de outra organização');
      const visual = assets.find((asset) => asset.id === input.visualAssetId);
      const sound = assets.find((asset) => asset.id === input.soundAssetId);
      if (visual?.kind === 'AUDIO' || (sound && sound.kind !== 'AUDIO'))
        throw new BadRequestException('Tipo de mídia incompatível');
    }
    return {
      name: input.name.trim(),
      enabled: input.enabled,
      isDefault: input.isDefault,
      priority: input.priority,
      minimumInCents:
        input.isDefault || input.minimumInCents === null
          ? null
          : BigInt(input.minimumInCents),
      maximumInCents:
        input.isDefault || input.maximumInCents === null
          ? null
          : BigInt(input.maximumInCents),
      template: input.template?.trim().slice(0, 50) || 'neon-pulse',
      accent: input.accent,
      textColor: input.textColor,
      fontFamily: input.fontFamily?.trim().slice(0, 80) || 'Inter',
      fontSize: input.fontSize,
      textAlign: input.textAlign,
      layout: {
        direction: input.layout?.direction === 'row' ? 'row' : 'column',
        position: layoutPosition,
        mediaFit: input.layout?.mediaFit === 'cover' ? 'cover' : 'contain',
      } as Prisma.InputJsonValue,
      minimumDurationMs: input.minimumDurationMs,
      maximumDurationMs: input.maximumDurationMs,
      soundVolume: input.soundVolume,
      ttsEnabled: input.ttsEnabled,
      ttsVoice: input.ttsVoice?.trim().slice(0, 80) || 'pt-BR-default',
      ttsRate: input.ttsRate,
      ttsVolume: input.ttsVolume,
      showSupporter: input.showSupporter,
      showAmount: input.showAmount,
      showMessage: input.showMessage,
      visualAssetId: input.visualAssetId || null,
      soundAssetId: input.soundAssetId || null,
    };
  }

  private defaultTheme() {
    return {
      template: 'neon-pulse',
      accent: '#a98cff',
      textColor: '#ffffff',
      fontFamily: 'Inter',
      fontSize: 32,
      textAlign: 'center',
      position: 'center',
    };
  }

  private normalizedTheme(value: Prisma.JsonValue) {
    const fallback = this.defaultTheme();
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return fallback;
    return { ...fallback, ...value };
  }

  private validateTheme(input: GlobalAppearanceInput) {
    const templates = [
      'neon-pulse',
      'card',
      'minimal',
      'video-focus',
      'song-compact',
    ];
    const positions = [
      'center',
      'top-center',
      'bottom-center',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'full',
    ];
    if (
      !templates.includes(input.template) ||
      !/^#[0-9a-f]{6}$/i.test(input.accent) ||
      !/^#[0-9a-f]{6}$/i.test(input.textColor) ||
      !input.fontFamily?.trim() ||
      input.fontFamily.length > 80 ||
      !Number.isInteger(input.fontSize) ||
      input.fontSize < 12 ||
      input.fontSize > 96 ||
      !['left', 'center', 'right'].includes(input.textAlign) ||
      !positions.includes(input.position)
    )
      throw new BadRequestException('AparÃªncia global invÃ¡lida');
    return {
      template: input.template,
      accent: input.accent,
      textColor: input.textColor,
      fontFamily: input.fontFamily.trim(),
      fontSize: input.fontSize,
      textAlign: input.textAlign,
      position: input.position,
    };
  }
  private validateAsset(input: {
    name: string;
    kind: string;
    mimeType: string;
    url: string;
    sizeInBytes: number;
    durationMs?: number;
  }) {
    const allowed: Record<string, string[]> = {
      IMAGE: ['image/png', 'image/jpeg', 'image/webp'],
      GIF: ['image/gif'],
      VIDEO: ['video/mp4', 'video/webm'],
      AUDIO: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
    };
    if (
      !input.name?.trim() ||
      !allowed[input.kind]?.includes(input.mimeType) ||
      !Number.isInteger(input.sizeInBytes) ||
      input.sizeInBytes < 1 ||
      input.sizeInBytes > (input.kind === 'VIDEO' ? 50_000_000 : 10_000_000)
    )
      throw new BadRequestException('Arquivo de mídia inválido');
    let url: URL;
    try {
      url = new URL(input.url);
    } catch {
      throw new BadRequestException('URL de mídia inválida');
    }
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      throw new BadRequestException('A mídia deve usar HTTPS');
    if (
      ['VIDEO', 'AUDIO'].includes(input.kind) &&
      (!Number.isInteger(input.durationMs) ||
        (input.durationMs ?? 0) < 1 ||
        (input.durationMs ?? 0) > 30_000)
    )
      throw new BadRequestException('A mídia deve ter no máximo 30 segundos');
  }
  private audit(
    actor: Actor,
    action: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action,
        targetType: 'AlertVariation',
        targetId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') return Number(value);
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    return value;
  }
}
