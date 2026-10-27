import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { cookieName, hashToken } from '@/lib/auth';
import { assertOrigin, route } from '@/lib/errors';
export async function POST(request: Request) { return route(async () => {
  assertOrigin(request);
  const jar = await cookies(); const token = jar.get(cookieName)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(cookieName); return Response.json({ ok: true });
}); }
