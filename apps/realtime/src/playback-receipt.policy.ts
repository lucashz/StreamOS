export const PLAYBACK_SEQUENCE: Readonly<Record<string, number>> = {
  RECEIVED: 1,
  MEDIA_READY: 2,
  STARTED: 3,
  COMPLETED: 4,
  MEDIA_FAILED: 4,
  FAILED: 4,
};

export function acceptsPlaybackReceipt(
  currentSequence: number | null,
  nextStatus: string,
) {
  const next = PLAYBACK_SEQUENCE[nextStatus];
  return Boolean(next && (currentSequence === null || next > currentSequence));
}
