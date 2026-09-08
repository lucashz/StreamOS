export function normalizeAndValidateTaxId(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 && validCpf(digits)) return digits;
  if (digits.length === 14 && validCnpj(digits)) return digits;
  return null;
}

export function normalizeAndValidatePixKey(type: string, value: string) {
  const normalizedType = type.trim().toUpperCase();
  const raw = value.trim();
  if (normalizedType === 'CPF' || normalizedType === 'CNPJ') {
    const taxId = normalizeAndValidateTaxId(raw);
    if (!taxId || taxId.length !== (normalizedType === 'CPF' ? 11 : 14))
      return null;
    return taxId;
  }
  if (normalizedType === 'EMAIL') {
    const email = raw.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 77
      ? email
      : null;
  }
  if (normalizedType === 'PHONE') {
    const digits = raw.replace(/\D/g, '');
    const phone = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    return /^\+55\d{10,11}$/.test(phone) ? phone : null;
  }
  if (normalizedType === 'RANDOM') {
    const key = raw.toLowerCase();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      key,
    )
      ? key
      : null;
  }
  return null;
}

function validCpf(value: string) {
  if (/^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1)
      sum += Number(value[index]) * (length + 1 - index);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validCnpj(value: string) {
  if (/^(\d)\1+$/.test(value)) return false;
  const calculate = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce(
      (total, weight, index) => total + Number(value[index]) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return (
    calculate(12) === Number(value[12]) && calculate(13) === Number(value[13])
  );
}
