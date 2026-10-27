import { requireUser, publicUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertOrigin, route } from '@/lib/errors';
import { rateLimit } from '@/services/limits';
export const dynamic = 'force-dynamic';
export async function GET() { return route(async () => {
  const actor = await requireUser();
  const conversations = await db.conversation.findMany({ where: actor.role === 'ANALYST' ? {} : { ownerId: actor.id }, orderBy: { updatedAt: 'desc' }, take: 100, include: { owner: true, assignedTo: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } });
  return Response.json(conversations.map(c => ({ ...c, owner: publicUser(c.owner), assignedTo: c.assignedTo ? publicUser(c.assignedTo) : null })));
}); }
export async function POST(request: Request) { return route(async () => {
  assertOrigin(request); const actor = await requireUser('EMPLOYEE');
  await rateLimit(`new-conversation:${actor.id}`, 30, 3600000);
  const conversation = await db.conversation.create({ data: { ownerId: actor.id } });
  return Response.json(conversation, { status: 201 });
}); }
