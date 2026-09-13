const DURABLE_MEDIA_KINDS = new Set(['SONG_PIX', 'VIDEO_PIX']);

export const DEFAULT_ALERT_MAX_AGE_SECONDS = 90;
export const DEFAULT_ALERT_PLAYBACK_TIMEOUT_SECONDS = 30;

export function isImmediateAlertKind(kind: string) {
  return !DURABLE_MEDIA_KINDS.has(kind);
}

export function shouldExpireQueuedAlert(
  kind: string,
  createdAt: Date,
  now: Date,
  maxAgeSeconds: number,
) {
  return (
    isImmediateAlertKind(kind) &&
    now.getTime() - createdAt.getTime() > maxAgeSeconds * 1_000
  );
}

export function immediatePlaybackTimeoutSeconds(configuredSeconds: number) {
  return Math.min(configuredSeconds, DEFAULT_ALERT_PLAYBACK_TIMEOUT_SECONDS);
}
