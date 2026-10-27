import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, hashToken } from '@/lib/auth';
import { assertOrigin, AppError, route } from '@/lib/errors';
import { rateLimit } from '@/services/limits';
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const { token, password } = z
      .object({
        token: z.string().min(32).max(100),
        password: z.string().min(12, 'Use ao menos 12 caracteres.').max(200),
      })
      .parse(await request.json());
    if (process.env.AUTH_MODE !== 'password')
      throw new AppError(400, 'A demonstração aceita qualquer senha.');
    await rateLimit(`reset-use:${hashToken(token)}`, 8, 600000);
    const passwordHash = await hashPassword(password);
    await db.$transaction(async (tx) => {
      const record = await tx.resetToken.findUnique({ where: { tokenHash: hashToken(token) } });
      if (!record || record.usedAt || record.expiresAt <= new Date())
        throw new AppError(400, 'Este link expirou ou já foi usado. Solicite outro.');
      const claimed = await tx.resetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!claimed.count) throw new AppError(400, 'Este link já foi usado.');
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.session.deleteMany({ where: { userId: record.userId } });
      await tx.resetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });
    return Response.json({ ok: true });
  });
}
