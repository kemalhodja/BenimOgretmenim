/** İş günü bazlı para çekme SLA — öğretmene gösterilen taahhüt. */
export const TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS = 5;

export function addBusinessDays(from: Date, businessDays: number): Date {
  const d = new Date(from.getTime());
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d;
}

export function estimatedWithdrawalCompletion(requestedAt: string | Date): Date {
  const base = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  return addBusinessDays(base, TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS);
}

export function withdrawalSlaLabelTr(): string {
  return `Onaylanan çekimler ${TEACHER_WITHDRAWAL_SLA_BUSINESS_DAYS} iş günü içinde banka hesabınıza aktarılır.`;
}
