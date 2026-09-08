export type PrechargePolicy = {
  name: string;
  blockedWords: string[];
  blockLinks: boolean;
  minimumInCents: bigint;
};

export function findBlockingPrechargePolicy(
  content: string,
  amountInCents: number,
  policies: PrechargePolicy[],
) {
  const normalized = content.toLocaleLowerCase('pt-BR');
  return policies.find(
    (policy) =>
      BigInt(amountInCents) < policy.minimumInCents ||
      (policy.blockLinks && /https?:\/\/|www\./i.test(content)) ||
      policy.blockedWords.some((word) =>
        normalized.includes(word.toLocaleLowerCase('pt-BR')),
      ),
  );
}
