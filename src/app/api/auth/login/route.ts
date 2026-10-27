import { z } from 'zod';
import { db } from '@/lib/db';
import { assertOrigin, AppError, route } from '@/lib/errors';
import { createSession, publicUser, verifyPassword } from '@/lib/auth';
import { rateLimit } from '@/services/limits';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const input = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.trim().toLowerCase()),
        password: z.string().min(1).max(200),
        remember: z.boolean().optional(),
      })
      .parse(await request.json());
    await rateLimit(`login:${input.email}`, 12, 600000);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const passwordMode = process.env.AUTH_MODE === 'password';
    if (
      !user ||
      (passwordMode &&
        (!user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))))
    )
      throw new AppError(401, 'E-mail ou senha inválidos.');
    await createSession(user.id, input.remember);
    return Response.json({ user: publicUser(user) });
  });
}
