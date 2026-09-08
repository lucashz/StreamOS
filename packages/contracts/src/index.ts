import { z } from 'zod';

export const eventEnvelopeSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive(),
  occurredAt: z.iso.datetime(),
  aggregateId: z.uuid(),
  organizationId: z.uuid(),
  correlationId: z.uuid(),
  causationId: z.uuid().nullable(),
  payload: z.record(z.string(), z.unknown()),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;
