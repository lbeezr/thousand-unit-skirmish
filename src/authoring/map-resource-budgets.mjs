function decimalParts(value) {
  const text = String(value);
  if (text.length > 700 || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) throw new Error('Invalid nonnegative resource amount.');
  const [mantissa, exponent = '0'] = text.toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  if (Math.abs(Number(exponent)) > 400) throw new Error('Resource exponent exceeds the supported numeric input range.');
  let units = BigInt(whole + fraction), scale = fraction.length - Number(exponent);
  if (scale < 0) { units *= 10n ** BigInt(-scale); scale = 0; }
  return { units, scale };
}

function decimalText({ units, scale }) {
  const text = units.toString().padStart(scale + 1, '0');
  if (!scale) return text;
  const fraction = text.slice(-scale).replace(/0+$/, '');
  return text.slice(0, -scale) + (fraction ? `.${fraction}` : '');
}

// Sum canonical authored numeric amounts as exact decimals. Strings keep a
// large total or tiny positive quantity from being rounded back through Number.
export function resourceBudget(types) {
  const sums = Object.fromEntries(types.map(type => [type, { units: 0n, scale: 0 }]));
  return {
    add(type, value) {
      if (!Object.hasOwn(sums, type)) throw new Error('Unsupported budget resource.');
      const next = decimalParts(value), sum = sums[type];
      const scale = Math.max(next.scale, sum.scale);
      sum.units = sum.units * 10n ** BigInt(scale - sum.scale) + next.units * 10n ** BigInt(scale - next.scale);
      sum.scale = scale;
    },
    values() { return Object.fromEntries(types.map(type => [type, decimalText(sums[type])])); },
  };
}

export function formatMapResourceAmount(value) {
  const [whole, fraction] = decimalText(decimalParts(value)).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}
