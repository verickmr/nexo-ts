import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { canReopen } from '@/domain/sla';
export class LegacyUnavailable extends AppError {
  constructor() {
    super(
      503,
      'O sistema de chamados está indisponível por alguns instantes. Nenhuma alteração foi confirmada.',
      'LEGACY_UNAVAILABLE',
    );
  }
}
export async function withLegacyRetry<T>(
  operation: () => Promise<T>,
  onRetry?: (attempt: number) => void,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (Math.random() < Number(process.env.LEGACY_FAILURE_RATE || 0))
        throw new LegacyUnavailable();
      return await operation();
    } catch (error) {
      if (!(error instanceof LegacyUnavailable) || attempt === 2) throw error;
      onRetry?.(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
    }
  }
  throw new LegacyUnavailable();
}
// Every employee operation takes the authenticated owner, never an LLM-supplied owner.
export const ticketService = {
  list: (ownerId: string) =>
    withLegacyRetry(() =>
      db.ticket.findMany({
        where: { ownerId },
        orderBy: { updatedAt: 'desc' },
        include: { updates: { orderBy: { createdAt: 'desc' } } },
      }),
    ),
  get: async (ownerId: string, ticketId: string) =>
    withLegacyRetry(async () => {
      const ticket = await db.ticket.findFirst({
        where: { ownerId, OR: [{ id: ticketId }, { number: ticketId }] },
      });
      if (!ticket) throw new AppError(404, 'Chamado não encontrado.');
      return ticket;
    }),
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ');
export function similarity(a: string, b: string) {
  const stop = new Set([
    'meu',
    'minha',
    'esta',
    'para',
    'com',
    'nao',
    'desde',
    'apos',
    'que',
    'uma',
    'chamado',
    'erro',
  ]);
  const words = (s: string) =>
    new Set(
      normalize(s)
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stop.has(w)),
    );
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return 0;
  return [...left].filter((w) => right.has(w)).length / Math.min(left.size, right.size);
}
export function findDuplicate<
  T extends {
    title: string;
    description: string;
    status: string;
    resolvedAt: Date | null;
    category: string;
  },
>(tickets: T[], title: string, category: string) {
  return tickets
    .filter((t) => t.category === category && (t.status !== 'RESOLVED' || canReopen(t.resolvedAt)))
    .map((ticket) => ({ ticket, score: similarity(title, ticket.title) }))
    .filter((item) => item.score >= 0.6)
    .sort((a, b) => b.score - a.score)[0]?.ticket;
}
