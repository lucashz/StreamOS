import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual, verify } from 'node:crypto';
import type {
  PaymentProvider,
  PixCharge,
  ProviderWebhook,
} from './payment-provider';

type WooviCharge = {
  correlationID?: string;
  status?: string;
  brCode?: string;
  qrCodeImage?: string;
  paymentLinkUrl?: string;
};

@Injectable()
export class WooviPaymentProvider implements PaymentProvider {
  readonly name = 'woovi';
  private readonly baseUrl =
    process.env.WOOVI_BASE_URL ?? 'https://api.woovi-sandbox.com';
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  async createCharge(input: {
    amountInCents: bigint;
    idempotencyKey: string;
    comment?: string;
    subaccountPixKey?: string;
    subaccountAmountInCents?: bigint;
  }): Promise<PixCharge> {
    const response = await this.call('/api/v1/charge', {
      method: 'POST',
      body: JSON.stringify({
        correlationID: input.idempotencyKey,
        value: Number(input.amountInCents),
        comment: this.chargeComment(input.comment),
        ...(input.subaccountPixKey && input.subaccountAmountInCents != null
          ? {
              splits: [
                {
                  pixKey: input.subaccountPixKey,
                  value: Number(input.subaccountAmountInCents),
                  splitType: 'SPLIT_SUB_ACCOUNT',
                },
              ],
            }
          : {}),
      }),
    });
    return this.charge(response, input.idempotencyKey);
  }

  async createSubaccount(input: { name: string; pixKey: string }) {
    const response = (await this.call('/api/v1/subaccount', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.slice(0, 120),
        pixKey: input.pixKey,
      }),
    })) as {
      SubAccount?: {
        id?: string;
        pixKey?: string;
        balance?: number;
        withdrawBlocked?: boolean;
      };
      subAccount?: {
        id?: string;
        pixKey?: string;
        balance?: number;
        withdrawBlocked?: boolean;
      };
    };
    return this.subaccount(
      response.SubAccount ?? response.subAccount,
      input.pixKey,
    );
  }

  async getSubaccount(id: string) {
    const response = (await this.call(
      `/api/v1/subaccount/${encodeURIComponent(id)}`,
      { method: 'GET' },
    )) as {
      SubAccount?: {
        id?: string;
        pixKey?: string;
        balance?: number;
        withdrawBlocked?: boolean;
      };
      subAccount?: {
        id?: string;
        pixKey?: string;
        balance?: number;
        withdrawBlocked?: boolean;
      };
    };
    return this.subaccount(response.SubAccount ?? response.subAccount, id);
  }

  async getSubaccountStatement(id: string) {
    const response = (await this.call(
      `/api/v1/subaccount/${encodeURIComponent(id)}/statement`,
      { method: 'GET' },
    )) as {
      transactions?: Array<{
        id?: string;
        correlationID?: string;
        value?: number;
        time?: string;
        createdAt?: string;
      }>;
    };
    return (response.transactions ?? []).flatMap((item) => {
      const occurredAt = new Date(item.time ?? item.createdAt ?? '');
      const reference = item.correlationID ?? item.id;
      return reference && !Number.isNaN(occurredAt.getTime())
        ? [
            {
              reference,
              amountInCents: BigInt(Math.trunc(item.value ?? 0)),
              occurredAt,
            },
          ]
        : [];
    });
  }

  async withdrawSubaccount(input: {
    id: string;
    amountInCents: bigint;
    idempotencyKey: string;
  }) {
    const response = (await this.call(
      `/api/v1/subaccount/${encodeURIComponent(input.id)}/withdraw`,
      {
        method: 'POST',
        body: JSON.stringify({
          value: Number(input.amountInCents),
          correlationID: input.idempotencyKey,
        }),
      },
    )) as {
      transaction?: {
        correlationID?: string;
        endToEndId?: string;
        status?: string;
      };
    };
    const transaction = response.transaction;
    return {
      reference:
        transaction?.endToEndId ??
        transaction?.correlationID ??
        input.idempotencyKey,
      status: this.pixOutStatus(transaction?.status),
    };
  }

  async getCharge(reference: string): Promise<PixCharge> {
    const response = await this.call(
      `/api/v1/charge/${encodeURIComponent(reference)}`,
      {
        method: 'GET',
      },
    );
    return this.charge(response, reference);
  }

  async getBalance() {
    const response = (await this.call('/api/v1/account/?skip=0&limit=100', {
      method: 'GET',
    })) as {
      accounts?: Array<{
        accountId?: string;
        isDefault?: boolean;
        balance?: { available?: number };
      }>;
    };
    const configured = process.env.WOOVI_ACCOUNT_ID;
    const account = configured
      ? response.accounts?.find((item) => item.accountId === configured)
      : (response.accounts?.find((item) => item.isDefault) ??
        response.accounts?.[0]);
    if (!account) throw new BadGatewayException('Conta Woovi não encontrada');
    return {
      availableInCents: BigInt(
        Math.max(0, Math.trunc(account.balance?.available ?? 0)),
      ),
    };
  }

  async requestPixOut(input: {
    amountInCents: bigint;
    destinationKey: string;
    idempotencyKey: string;
  }) {
    const sourceKey = process.env.WOOVI_SOURCE_PIX_KEY;
    if (!sourceKey)
      throw new BadRequestException('WOOVI_SOURCE_PIX_KEY não configurada');
    const response = (await this.call('/api/v1/transfer', {
      method: 'POST',
      body: JSON.stringify({
        value: Number(input.amountInCents),
        fromPixKey: sourceKey,
        toPixKey: input.destinationKey,
        correlationID: input.idempotencyKey,
      }),
    })) as {
      transaction?: { correlationID?: string; endToEndId?: string };
    };
    return {
      reference:
        response.transaction?.endToEndId ??
        response.transaction?.correlationID ??
        input.idempotencyKey,
      status: 'PAID' as const,
    };
  }

  async getPixOut(reference: string) {
    const response = (await this.call(
      `/api/v1/transaction/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    )) as {
      transaction?: {
        correlationID?: string;
        endToEndId?: string;
        status?: string;
      };
    };
    const transaction = response.transaction;
    if (!transaction)
      throw new BadGatewayException('Transferência Woovi não encontrada');
    const status = String(transaction.status ?? 'COMPLETED').toUpperCase();
    return {
      reference:
        transaction.endToEndId ?? transaction.correlationID ?? reference,
      status: ['FAILED', 'REJECTED', 'CANCELLED'].includes(status)
        ? ('FAILED' as const)
        : ['PENDING', 'PROCESSING', 'CREATED'].includes(status)
          ? ('REQUESTED' as const)
          : ('PAID' as const),
    };
  }

  async getStatement(from: Date, to: Date) {
    const result: Array<{
      reference: string;
      amountInCents: bigint;
      occurredAt: Date;
    }> = [];
    let skip = 0;
    for (;;) {
      const query = new URLSearchParams({
        start: from.toISOString(),
        end: to.toISOString(),
        skip: String(skip),
        limit: '100',
      });
      const response = (await this.call(`/api/v1/transaction?${query}`, {
        method: 'GET',
      })) as {
        transactions?: Array<{
          id?: string;
          correlationID?: string;
          endToEndId?: string;
          value?: number;
          time?: string;
        }>;
        pageInfo?: { hasNextPage?: boolean; skip?: number; limit?: number };
      };
      for (const transaction of response.transactions ?? []) {
        const reference =
          transaction.correlationID ?? transaction.endToEndId ?? transaction.id;
        const occurredAt = transaction.time ? new Date(transaction.time) : null;
        if (
          reference &&
          occurredAt &&
          !Number.isNaN(occurredAt.getTime()) &&
          Number.isFinite(transaction.value)
        )
          result.push({
            reference,
            amountInCents: BigInt(Math.trunc(transaction.value ?? 0)),
            occurredAt,
          });
      }
      if (!response.pageInfo?.hasNextPage) break;
      skip =
        (response.pageInfo.skip ?? skip) + (response.pageInfo.limit ?? 100);
      if (skip > 10_000)
        throw new BadGatewayException('Paginação Woovi excedeu o limite');
    }
    return result;
  }

  async processRegulatoryIncident(input: {
    paymentReference: string;
    kind: 'MED' | 'COMPULSORY_RETURN';
    reason: string;
  }) {
    if (input.kind !== 'MED')
      throw new BadRequestException(
        'Devolução voluntária não é permitida; retornos compulsórios são processados por evento regulatório',
      );
    const response = (await this.call('/api/v1/funds-recovery', {
      method: 'POST',
      body: JSON.stringify({
        transactionEndToEndId: input.paymentReference,
        situationType: 'OTHER',
        details: input.reason.slice(0, 2_000),
      }),
    })) as {
      fundsRecovery?: { dictId?: string; id?: string };
      dictId?: string;
      id?: string;
    };
    const incidentReference =
      response.fundsRecovery?.dictId ??
      response.fundsRecovery?.id ??
      response.dictId ??
      response.id;
    if (!incidentReference)
      throw new BadGatewayException('Woovi não retornou a referência do MED');
    return { incidentReference };
  }

  async reconcile(reference: string) {
    const charge = await this.getCharge(reference);
    return charge.status === 'CONFIRMED'
      ? ('CONFIRMED' as const)
      : charge.status === 'PENDING'
        ? ('PENDING' as const)
        : ('DIVERGENT' as const);
  }

  parseWebhook(
    body: unknown,
    authorization?: string,
    rawBody?: Buffer,
    providerSignature?: string,
  ): ProviderWebhook {
    const publicKey = process.env.WOOVI_WEBHOOK_PUBLIC_KEY?.replaceAll(
      '\\n',
      '\n',
    );
    if (publicKey) {
      if (
        !rawBody ||
        !providerSignature ||
        !verify(
          'RSA-SHA256',
          rawBody,
          publicKey,
          Buffer.from(providerSignature, 'base64'),
        )
      )
        throw new BadRequestException('Assinatura RSA do webhook inválida');
    }
    const expected = process.env.WOOVI_WEBHOOK_AUTHORIZATION ?? '';
    const received = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (
      !publicKey &&
      (!expected ||
        expectedBuffer.length !== receivedBuffer.length ||
        !timingSafeEqual(expectedBuffer, receivedBuffer))
    )
      throw new BadRequestException('Autorização do webhook inválida');
    const payload = body as {
      event?: unknown;
      charge?: {
        correlationID?: unknown;
        transactionID?: unknown;
        status?: unknown;
      };
      pix?: { transactionID?: unknown };
    };
    const event = this.stringValue(payload.event).toUpperCase();
    const intentId = this.stringValue(payload.charge?.correlationID);
    if (
      !['OPENPIX:CHARGE_COMPLETED', 'WOOVI:CHARGE_COMPLETED'].includes(event) ||
      !intentId
    )
      throw new BadRequestException('Evento Woovi ignorado ou inválido');
    const transaction = this.stringValue(
      payload.charge?.transactionID ?? payload.pix?.transactionID ?? intentId,
    );
    return {
      eventId: `${event}:${transaction}`,
      type: 'payment.confirmed',
      intentId,
    };
  }

  private async call(path: string, init: RequestInit) {
    if (Date.now() < this.circuitOpenUntil)
      throw new BadGatewayException(
        'Woovi temporariamente isolada após falhas consecutivas',
      );
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: process.env.WOOVI_APP_ID ?? '',
        },
        signal: AbortSignal.timeout(8_000),
      });
      const text = await response.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { raw: text.slice(0, 500) };
      }
      if (!response.ok) {
        const detail = this.providerError(body);
        throw new BadGatewayException(
          `Woovi HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
        );
      }
      this.consecutiveFailures = 0;
      this.circuitOpenUntil = 0;
      return body;
    } catch (error) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= 3)
        this.circuitOpenUntil = Date.now() + 30_000;
      throw error;
    }
  }

  private stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
  }

  private chargeComment(value?: string) {
    const normalized = (value ?? 'Apoio via StreamOS')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    return normalized || 'Apoio via StreamOS';
  }

  private providerError(body: unknown) {
    if (!body || typeof body !== 'object') return '';
    const value = body as {
      error?: unknown;
      message?: unknown;
      errors?: Array<{ message?: unknown }>;
    };
    const detail =
      (typeof value.message === 'string' && value.message) ||
      (typeof value.error === 'string' && value.error) ||
      (Array.isArray(value.errors) &&
        value.errors
          .map((item) =>
            typeof item?.message === 'string' ? item.message : '',
          )
          .filter(Boolean)
          .join('; ')) ||
      '';
    return detail.replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  private subaccount(
    value:
      | {
          id?: string;
          pixKey?: string;
          balance?: number;
          withdrawBlocked?: boolean;
        }
      | undefined,
    fallbackId: string,
  ) {
    if (!value) throw new BadGatewayException('Woovi não retornou a subconta');
    const pixKey = value.pixKey ?? fallbackId;
    return {
      id: value.id ?? pixKey,
      pixKey,
      balanceInCents: BigInt(Math.max(0, Math.trunc(value.balance ?? 0))),
      withdrawBlocked: value.withdrawBlocked === true,
    };
  }

  private pixOutStatus(status?: string) {
    const normalized = String(status ?? 'COMPLETED').toUpperCase();
    if (['FAILED', 'REJECTED', 'CANCELLED'].includes(normalized))
      return 'FAILED' as const;
    if (['PENDING', 'PROCESSING', 'CREATED'].includes(normalized))
      return 'REQUESTED' as const;
    return 'PAID' as const;
  }

  private charge(body: unknown, fallbackReference: string): PixCharge {
    const wrapper = body as { charge?: WooviCharge } & WooviCharge;
    const charge = wrapper.charge ?? wrapper;
    const copyPaste = charge.brCode;
    if (!copyPaste)
      throw new BadGatewayException('Woovi não retornou o código Pix');
    return {
      reference: charge.correlationID ?? fallbackReference,
      pixCopyPaste: copyPaste,
      qrCodePayload: charge.qrCodeImage ?? copyPaste,
      status:
        charge.status === 'COMPLETED'
          ? 'CONFIRMED'
          : charge.status === 'EXPIRED'
            ? 'EXPIRED'
            : 'PENDING',
    };
  }
}
