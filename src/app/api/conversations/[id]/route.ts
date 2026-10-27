import { requireUser } from '@/lib/auth';
import { route } from '@/lib/errors';
import { snapshot } from '@/services/conversations';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { return route(async () => Response.json(await snapshot((await context.params).id, await requireUser()))); }
