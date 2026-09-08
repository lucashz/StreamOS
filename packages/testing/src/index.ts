export function fixedClock(isoDate: string): () => Date {
  const instant = new Date(isoDate);
  return () => new Date(instant);
}
