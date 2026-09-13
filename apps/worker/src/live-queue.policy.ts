export const DEFAULT_ALERT_MAX_AGE_SECONDS = 90;
export const DEFAULT_ALERT_PLAYBACK_TIMEOUT_SECONDS = 30;

export function isTemporaryAlert(sourceType: string) {
  return sourceType.startsWith('alert.test.');
}

export function shouldExpireQueuedAlert(
  sourceType: string,
  createdAt: Date,
  now: Date,
  maxAgeSeconds: number,
) {
  return (
    isTemporaryAlert(sourceType) &&
    now.getTime() - createdAt.getTime() > maxAgeSeconds * 1_000
  );
}

export function immediatePlaybackTimeoutSeconds(configuredSeconds: number) {
  return Math.min(configuredSeconds, DEFAULT_ALERT_PLAYBACK_TIMEOUT_SECONDS);
}
