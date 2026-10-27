import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashToken } from '@/lib/auth';
import { assertOrigin, route } from '@/lib/errors';
import { rateLimit } from '@/services/limits';
import { sendResetEmail } from '@/services/mail';
export async function POST(request: Request) {
  return route(async () => {
    assertOrigin(request);
    const { email } = z
      .object({ email: z.email().transform((v) => v.toLowerCase().trim()) })
      .parse(await request.json());
    await rateLimit(`reset:${email}`, 3, 3600000);
    if (process.env.AUTH_MODE === 'password') {
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        const token = randomBytes(32).toString('base64url');
        const record = await db.resetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 1800000),
          },
        });
        try {
          await sendResetEmail(email, token);
        } catch {
          await db.resetToken.delete({ where: { id: record.id } });
          console.error('[mail] Envio de recuperação indisponível.');
        }
      }
    }
    return Response.json({
      message:
        process.env.AUTH_MODE === 'password'
          ? 'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
          : 'Esta é uma demonstração. Entre com um dos e-mails de exemplo e qualquer senha.',
    });
  });
}
