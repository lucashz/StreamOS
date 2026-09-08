export const TERMINAL_LIVE_STATUSES = [
  'COMPLETED',
  'MEDIA_FAILED',
  'SKIPPED',
  'FAILED',
  'EXPIRED',
] as const;

export const LIVE_OPERATOR_ROLES = ['OWNER', 'ADMIN', 'MODERATOR'] as const;
export const LIVE_QUEUE_MODES = ['BALANCED', 'VALUE', 'FIFO'] as const;
export type LiveQueueMode = (typeof LIVE_QUEUE_MODES)[number];

export const LIVE_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  QUEUED: ['COMPLETED', 'MEDIA_FAILED', 'SKIPPED', 'FAILED', 'EXPIRED'],
  DISPATCHING: ['QUEUED'],
  PLAYING: [
    'QUEUED',
    'DISPATCHING',
    'COMPLETED',
    'SKIPPED',
    'FAILED',
    'MEDIA_FAILED',
  ],
  COMPLETED: ['PLAYING'],
  MEDIA_FAILED: ['PLAYING', 'DISPATCHING'],
  SKIPPED: ['QUEUED', 'DISPATCHING', 'PLAYING'],
  FAILED: ['DISPATCHING', 'PLAYING'],
  EXPIRED: ['QUEUED', 'DISPATCHING'],
};

export function canOperateLiveQueue(role: string) {
  return LIVE_OPERATOR_ROLES.includes(
    role as (typeof LIVE_OPERATOR_ROLES)[number],
  );
}

export function canTransitionLiveQueue(from: string, to: string) {
  return from === to || Boolean(LIVE_TRANSITIONS[to]?.includes(from));
}

export function orderedQueue<
  T extends { position: number; createdAt: Date; id: string },
>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      left.position - right.position ||
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
}

type PrioritizedItem = {
  id: string;
  position: number;
  createdAt: Date;
  kind: string;
  supporterName?: string | null;
  amountInCents?: bigint | number | null;
  metadata?: unknown;
};

const mediaKinds = new Set(['VIDEO_PIX', 'SONG_PIX']);

export function prioritizedQueue<T extends PrioritizedItem>(
  items: T[],
  mode: LiveQueueMode,
  completedOffset = 0,
  recent: Array<Pick<PrioritizedItem, 'kind' | 'supporterName'>> = [],
) {
  const fifo = orderedQueue(items);
  const manualPosition = (item: T) => {
    if (!item.metadata || typeof item.metadata !== 'object') return undefined;
    const value = (item.metadata as Record<string, unknown>)
      .manualQueuePosition;
    return typeof value === 'number' && Number.isInteger(value) && value > 0
      ? value
      : undefined;
  };
  const manuallyPositioned = fifo.filter(
    (item) => manualPosition(item) !== undefined,
  );
  const pool = fifo.filter((item) => manualPosition(item) === undefined);
  const applyManualPositions = (ordered: T[]) => {
    const result = [...ordered];
    for (const item of manuallyPositioned.sort(
      (left, right) =>
        (manualPosition(left) ?? 1) - (manualPosition(right) ?? 1),
    ))
      result.splice(
        Math.min(manualPosition(item) ?? 1, result.length + 1) - 1,
        0,
        item,
      );
    return result;
  };
  const byValue = (entries: T[]) =>
    [...entries].sort(
      (left, right) =>
        Number(right.amountInCents ?? 0) - Number(left.amountInCents ?? 0) ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.position - right.position ||
        left.id.localeCompare(right.id),
    );
  if (mode === 'FIFO') return fifo;
  if (mode === 'VALUE') return applyManualPositions(byValue(pool));

  const remaining = [...pool];
  const result: T[] = [];
  const played = [...recent];
  while (remaining.length) {
    const slot = (completedOffset + result.length) % 5;
    const oldest = [...remaining].sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.position - right.position,
    );
    const desired =
      slot === 1
        ? oldest.filter((item) => !mediaKinds.has(item.kind))
        : slot === 2
          ? byValue(remaining.filter((item) => mediaKinds.has(item.kind)))
          : slot === 4
            ? oldest
            : byValue(remaining);
    let candidates = desired.length ? desired : byValue(remaining);
    const last = played.at(-1);
    const lastTwo = played.slice(-2);
    const lastThree = played.slice(-3);
    const alternatives = candidates.filter((item) => {
      if (
        last?.supporterName &&
        item.supporterName &&
        item.supporterName === last.supporterName
      )
        return false;
      if (
        lastTwo.length === 2 &&
        lastTwo.every((entry) => mediaKinds.has(entry.kind)) &&
        mediaKinds.has(item.kind)
      )
        return false;
      if (
        lastThree.length === 3 &&
        lastThree.every((entry) => entry.kind === lastThree[0]?.kind) &&
        item.kind === lastThree[0]?.kind
      )
        return false;
      return true;
    });
    if (alternatives.length) candidates = alternatives;
    const selected = candidates[0] ?? remaining[0];
    if (!selected) break;
    result.push(selected);
    played.push(selected);
    remaining.splice(
      remaining.findIndex((item) => item.id === selected.id),
      1,
    );
  }
  return applyManualPositions(result);
}

export function shouldSuppressGenericPaymentAlert(
  payload: Record<string, unknown>,
  specializedIntentIds: ReadonlySet<string>,
) {
  return (
    payload.suppressGenericAlert === true ||
    (typeof payload.intentId === 'string' &&
      specializedIntentIds.has(payload.intentId))
  );
}
