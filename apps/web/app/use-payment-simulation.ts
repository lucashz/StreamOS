'use client';

import { useEffect, useState } from 'react';

const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function usePaymentSimulation() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void fetch(`${api}/public/payment-simulation`, { cache: 'no-store' })
      .then(async (response) =>
        response.ok
          ? ((await response.json()) as { enabled?: boolean })
          : undefined,
      )
      .then((result) => setEnabled(result?.enabled === true))
      .catch(() => setEnabled(false));
  }, []);

  return enabled;
}
