export type BacklogState = {
  level: 'normal' | 'warning';
  estimatedSeconds: number;
  reason?: string;
};

export function backlogState({
  pendingCount,
  estimatedSeconds,
}: {
  pendingCount: number;
  estimatedSeconds: number;
}): BacklogState {
  if (estimatedSeconds >= 15 * 60) {
    return {
      level: 'warning',
      estimatedSeconds,
      reason: 'A espera estimada ultrapassa 15 minutos.',
    };
  }

  if (pendingCount >= 100) {
    return {
      level: 'warning',
      estimatedSeconds,
      reason: 'Há 100 alertas aguardando na fila.',
    };
  }

  return { level: 'normal', estimatedSeconds };
}
