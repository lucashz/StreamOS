export function mockPaymentsEnabled(environment: NodeJS.ProcessEnv) {
  return (
    environment.NODE_ENV !== 'production' ||
    environment.ENABLE_MOCK_PAYMENTS === 'true'
  );
}

export function useLocalSimulatedCharge(
  environment: NodeJS.ProcessEnv,
  providerName: string,
) {
  return providerName !== 'mock' && mockPaymentsEnabled(environment);
}
