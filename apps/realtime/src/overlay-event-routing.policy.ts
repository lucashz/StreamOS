type WidgetRoute = {
  id: string;
  type: string;
  enabled: boolean;
  deletedAt: Date | null;
};

type RoutedEvent = {
  eventType: string;
  payload: Record<string, unknown>;
};

export function widgetAcceptsEvent(widget: WidgetRoute, event: RoutedEvent) {
  if (!widget.enabled || widget.deletedAt) return false;
  const target = event.payload.targetWidgetId;
  if (typeof target === 'string' && target !== widget.id) return false;
  if (widget.type === 'QR_CODE') return false;
  if (widget.type === 'GOAL') return event.eventType === 'goal.updated.v1';
  if (widget.type === 'SONG_PIX')
    return [
      'song.requested.v1',
      'song.started.v1',
      'song.skipped.v1',
      'song.completed.v1',
    ].includes(event.eventType);
  if (widget.type === 'VIDEO_PIX')
    return [
      'video.requested.v1',
      'video.started.v1',
      'video.skipped.v1',
      'video.completed.v1',
      'video.unavailable.v1',
    ].includes(event.eventType);
  if (widget.type === 'CAMPAIGN')
    return event.eventType === 'campaign.contribution.confirmed.v1';
  if (widget.type === 'SUBSCRIPTION')
    return event.eventType === 'subscription.created.v1';
  if (
    widget.type === 'ALERT' &&
    event.eventType.startsWith('live.queue.item.')
  ) {
    const kind = event.payload.kind;
    return typeof kind === 'string' && ['ALERT', 'AUDIO', 'TTS'].includes(kind);
  }
  return [
    'payment.confirmed.v1',
    'alert.test.v1',
    'alert.test.v2',
    'message.approved.v1',
    'tts.queued.v1',
    'live.queue.item.playing.v1',
    'live.queue.item.played.v1',
    'live.queue.item.skipped.v1',
    'live.queue.item.failed.v1',
    'live.queue.item.rejected.v1',
    'live.queue.item.canceled.v1',
  ].includes(event.eventType);
}
