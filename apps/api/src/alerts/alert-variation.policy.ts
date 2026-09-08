export type VariationRange = {
  id: string;
  enabled: boolean;
  isDefault: boolean;
  priority: number;
  minimumInCents: bigint | null;
  maximumInCents: bigint | null;
  createdAt: Date;
};

export function selectAlertVariation<T extends VariationRange>(
  variations: T[],
  amountInCents: bigint,
  targetVariationId?: string,
) {
  if (targetVariationId) {
    const targeted = variations.find(
      (item) => item.id === targetVariationId && item.enabled,
    );
    if (targeted) return targeted;
  }
  const matches = variations
    .filter(
      (item) =>
        item.enabled &&
        !item.isDefault &&
        (item.minimumInCents === null ||
          amountInCents >= item.minimumInCents) &&
        (item.maximumInCents === null || amountInCents <= item.maximumInCents),
    )
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        Number((right.minimumInCents ?? 0n) - (left.minimumInCents ?? 0n)) ||
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    );
  return (
    matches[0] ??
    variations
      .filter((item) => item.enabled && item.isDefault)
      .sort(
        (left, right) =>
          right.priority - left.priority || left.id.localeCompare(right.id),
      )[0]
  );
}

export function validAlertRange(
  minimum: number | null,
  maximum: number | null,
) {
  return (
    (minimum === null || (Number.isInteger(minimum) && minimum >= 0)) &&
    (maximum === null || (Number.isInteger(maximum) && maximum >= 0)) &&
    (minimum === null || maximum === null || minimum <= maximum)
  );
}
