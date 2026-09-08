import { describe, expect, it } from 'vitest';
import { widgetAcceptsEvent } from './overlay-event-routing.policy';

const widget = (type: string) => ({
  id: `widget-${type}`,
  type,
  enabled: true,
  deletedAt: null,
});
const queueEvent = (kind: string, eventType = 'live.queue.item.playing.v1') => ({
  eventType,
  payload: { kind },
});

describe('overlay event routing', () => {
  it.each(['ALERT', 'AUDIO', 'TTS'])(
    'routes %s to the alert overlay',
    (kind) => expect(widgetAcceptsEvent(widget('ALERT'), queueEvent(kind))).toBe(true),
  );

  it.each(['SONG_PIX', 'VIDEO_PIX', 'SUBSCRIPTION', 'CAMPAIGN'])(
    'never renders %s as a generic zero-value alert',
    (kind) => expect(widgetAcceptsEvent(widget('ALERT'), queueEvent(kind))).toBe(false),
  );

  it('keeps media isolated in its dedicated channel', () => {
    expect(
      widgetAcceptsEvent(widget('SONG_PIX'), {
        eventType: 'song.started.v1',
        payload: {},
      }),
    ).toBe(true);
    expect(
      widgetAcceptsEvent(widget('VIDEO_PIX'), {
        eventType: 'video.started.v1',
        payload: {},
      }),
    ).toBe(true);
    expect(
      widgetAcceptsEvent(widget('SONG_PIX'), {
        eventType: 'video.started.v1',
        payload: {},
      }),
    ).toBe(false);
  });

  it('honors activation, deletion and explicit widget targeting', () => {
    expect(
      widgetAcceptsEvent({ ...widget('ALERT'), enabled: false }, queueEvent('ALERT')),
    ).toBe(false);
    expect(
      widgetAcceptsEvent({ ...widget('ALERT'), deletedAt: new Date() }, queueEvent('ALERT')),
    ).toBe(false);
    expect(
      widgetAcceptsEvent(widget('ALERT'), {
        eventType: 'alert.test.v2',
        payload: { targetWidgetId: 'another-widget' },
      }),
    ).toBe(false);
  });
});
