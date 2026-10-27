import { db } from '@/lib/db';
import { AppError } from '@/lib/errors';
// Database-backed limits also work across restarts and serverless instances.
export async function rateLimit(key: string, max: number, windowMs: number) {
  const bucket = `${key}:${Math.floor(Date.now() / windowMs)}`;
  const usage = await db.usage.upsert({
    where: { key: bucket },
    create: { key: bucket, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (usage.count > max)
    throw new AppError(
      429,
      'Muitas solicitações. Aguarde um pouco e tente novamente.',
      'RATE_LIMIT',
    );
}
export async function reserveAiCall() {
  const key = `ai:${new Date().toISOString().slice(0, 10)}`;
  const usage = await db.usage.upsert({
    where: { key },
    create: { key, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (
    usage.count > Number(process.env.MAX_DAILY_AI_CALLS || 200) ||
    usage.tokens >= Number(process.env.MAX_DAILY_AI_TOKENS || 150000)
  ) {
    throw new AppError(
      429,
      'O limite diário da demonstração foi atingido. Você pode consultar seu histórico e falar com um analista.',
      'DAILY_LIMIT',
    );
  }
  return key;
}
export async function recordTokens(key: string, tokens: number) {
  await db.usage.update({ where: { key }, data: { tokens: { increment: tokens } } });
}
