// amount_due remains the ticket total. Partial payments are tracked separately.
export function ballBalance(reservation) {
  const total = Number(reservation.amount_due ?? 0);
  const paid = Number(reservation.amount_paid ?? (reservation.cash_received ? total : 0));
  return { total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100), credit: Math.max(0, Math.round((paid - total) * 100) / 100) };
}
