import type { FocusEvent, KeyboardEvent } from 'react';

export function selectZeroMoneyValue(event: FocusEvent<HTMLInputElement>) {
  if (Number(event.currentTarget.value.replace(',', '.')) !== 0) return;
  requestAnimationFrame(() => event.currentTarget.select());
}

export function replaceZeroMoneyValue(event: KeyboardEvent<HTMLInputElement>) {
  if (!/^\d$/.test(event.key)) return;
  if (Number(event.currentTarget.value.replace(',', '.')) !== 0) return;
  event.currentTarget.value = '';
}
