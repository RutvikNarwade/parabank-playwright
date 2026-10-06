/** Formats an amount the way ParaBank's pages do: "$1234.50", "-$12.00" (no thousands separator). */
export function formatMoney(amount: number): string {
  return `${amount < 0 ? '-' : ''}$${Math.abs(amount).toFixed(2)}`;
}
