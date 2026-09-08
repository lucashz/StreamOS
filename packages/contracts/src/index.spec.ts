import { describe, expect, it } from 'vitest';

import { eventEnvelopeSchema } from './index';

describe('eventEnvelopeSchema', () => {
  it('rejects envelopes without an event type', () => {
    expect(eventEnvelopeSchema.safeParse({}).success).toBe(false);
  });
});
