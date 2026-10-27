import { describe, expect, it } from 'vitest';
import { addBusinessHours, canReopen, classifyPriority, dueDate, isOverdue } from '@/domain/sla';
import { findDuplicate } from '@/services/tickets';
describe('Prioridade pela combinação de impacto e urgência', () => {
  it.each([
    ['TEAM', 'BLOCKED', 'CRITICAL'], ['COMPANY', 'BLOCKED', 'CRITICAL'],
    ['PERSON', 'BLOCKED', 'HIGH'], ['PERSON', 'TODAY', 'HIGH'], ['TEAM', 'TODAY', 'HIGH'],
    ['PERSON', 'WORKAROUND', 'MEDIUM'], ['TEAM', 'WORKAROUND', 'MEDIUM'], ['PERSON', 'NO_RUSH', 'LOW']
  ])('%s / %s → %s', (impact, urgency, priority) => expect(classifyPriority(impact, urgency)).toBe(priority));
});
describe('SLA no calendário de São Paulo', () => {
  it('atravessa o fim de semana sem contar horas fora do expediente', () => {
    expect(addBusinessHours(new Date('2026-10-23T20:00:00Z'), 4).toISOString()).toBe('2026-10-26T14:00:00.000Z');
  });
  it('começa às 8h quando o pedido chega antes do expediente', () => {
    expect(addBusinessHours(new Date('2026-10-27T08:30:00Z'), 4).toISOString()).toBe('2026-10-27T15:00:00.000Z');
  });
  it('preserva minutos e segundos no fechamento do expediente', () => {
    expect(addBusinessHours(new Date('2026-10-27T20:30:30Z'), 1).toISOString()).toBe('2026-10-28T11:30:30.000Z');
  });
  it('conta três dias úteis como trinta horas de expediente', () => {
    expect(dueDate('MEDIUM', new Date('2026-10-23T19:00:00Z')).toISOString()).toBe('2026-10-28T19:00:00.000Z');
  });
  it('mantém o plantão crítico em horas corridas no domingo', () => {
    expect(dueDate('CRITICAL', new Date('2026-10-25T02:00:00Z')).toISOString()).toBe('2026-10-25T03:00:00.000Z');
  });
  it('não considera vencido um chamado resolvido ou exatamente no limite', () => {
    const now = new Date(); expect(isOverdue({ status: 'RESOLVED', dueAt: new Date(0) }, now)).toBe(false);
    expect(isOverdue({ status: 'OPEN', dueAt: now }, now)).toBe(false);
  });
});
describe('Reabertura e duplicidade', () => {
  const now = new Date('2026-10-27T15:00:00Z');
  it('aceita o limite de sete dias e recusa um milissegundo além', () => {
    expect(canReopen(new Date(now.getTime() - 7 * 86400000), now)).toBe(true);
    expect(canReopen(new Date(now.getTime() - 7 * 86400000 - 1), now)).toBe(false);
    expect(canReopen(new Date(now.getTime() + 1), now)).toBe(false);
  });
  it('encontra problema semelhante aberto e respeita categoria e resolução antiga', () => {
    const ticket = { title: 'VPN não conecta no notebook', description: '', category: 'NETWORK', status: 'OPEN', resolvedAt: null };
    expect(findDuplicate([ticket], 'Meu notebook não conecta na VPN', 'NETWORK')).toBe(ticket);
    expect(findDuplicate([ticket], 'Meu notebook não conecta na VPN', 'HARDWARE')).toBeUndefined();
    expect(findDuplicate([{ ...ticket, status: 'RESOLVED', resolvedAt: new Date(0) }], 'VPN não conecta', 'NETWORK')).toBeUndefined();
  });
});
