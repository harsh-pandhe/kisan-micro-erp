/** Formats integer minor units (paise) as a display rupee amount. Never used for calculation. */
export function formatMinor(amountMinor: number): string {
  return `₹${(amountMinor / 100).toFixed(2)}`;
}
