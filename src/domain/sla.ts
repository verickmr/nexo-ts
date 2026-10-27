import type { Priority } from '@/generated/prisma/enums';
const hour = 3600000;
// São Paulo has a fixed UTC-3 offset in the documented demo calendar.
export function addBusinessHours(start: Date, hours: number): Date {
  let time = new Date(start.getTime() - 3 * hour);
  let remaining = hours;
  while (remaining > 0) {
    if (time.getUTCDay() === 0 || time.getUTCDay() === 6 || time.getUTCHours() >= 18) {
      time.setUTCDate(time.getUTCDate() + 1);
      time.setUTCHours(8, 0, 0, 0);
      continue;
    }
    if (time.getUTCHours() < 8) time.setUTCHours(8, 0, 0, 0);
    const end = new Date(time);
    end.setUTCHours(18, 0, 0, 0);
    const available = (end.getTime() - time.getTime()) / hour;
    const consumed = Math.min(remaining, available);
    time = new Date(time.getTime() + consumed * hour);
    remaining -= consumed;
  }
  return new Date(time.getTime() + 3 * hour);
}
export function dueDate(priority: Priority, from = new Date()) {
  return priority === 'CRITICAL'
    ? new Date(from.getTime() + hour)
    : addBusinessHours(from, { HIGH: 4, MEDIUM: 30, LOW: 50 }[priority]);
}
export function classifyPriority(impact: string, urgency: string): Priority {
  if ((impact === 'TEAM' || impact === 'COMPANY') && urgency === 'BLOCKED') return 'CRITICAL';
  if (urgency === 'BLOCKED' || urgency === 'TODAY') return 'HIGH';
  return urgency === 'WORKAROUND' ? 'MEDIUM' : 'LOW';
}
export function canReopen(resolvedAt: Date | null, now = new Date()) {
  return (
    resolvedAt !== null &&
    now.getTime() >= resolvedAt.getTime() &&
    now.getTime() - resolvedAt.getTime() <= 7 * 86400000
  );
}
export function isOverdue(ticket: { status: string; dueAt: Date }, now = new Date()) {
  return ticket.status !== 'RESOLVED' && ticket.dueAt < now;
}
export const slaLabels = {
  CRITICAL: '1 hora · plantão 24h',
  HIGH: '4 horas úteis',
  MEDIUM: '3 dias úteis',
  LOW: '5 dias úteis',
} as const;
