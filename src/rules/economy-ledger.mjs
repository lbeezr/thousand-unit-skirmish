/** Preserve fractional cargo; collapse only floating-point noise around a whole balance. */
export function creditResourceBalance(balance, amount) {
  const total = balance + amount;
  const whole = Math.round(total);
  return Math.abs(total - whole) <= Number.EPSILON * Math.max(1, Math.abs(total)) * 16
    ? whole : total;
}
