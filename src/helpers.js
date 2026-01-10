export function formatIRR(n) {
  const x = Math.round(Number(n) || 0).toString();
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IRR';
}
