import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { db } from './db';
import { AppError } from './errors';
import type { User } from '@/generated/prisma/client';
const scrypt = promisify(scryptCallback);
export const cookieName = 'nexo_session';
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [algorithm, salt, encoded] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(encoded, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    os: user.os,
    team: user.team,
    passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
  };
}
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
export async function requireUser(role?: 'EMPLOYEE' | 'ANALYST') {
  const user = await currentUser();
  if (!user) throw new AppError(401, 'Entre para continuar.');
  if (role && user.role !== role) throw new AppError(403, 'Você não tem acesso a esta área.');
  return user;
}
export async function createSession(userId: string, remember = false) {
  const token = randomBytes(32).toString('base64url');
  const seconds = (remember ? 30 : 1) * 86400;
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + seconds * 1000) },
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'lax',
    path: '/',
    maxAge: seconds,
  });
}
