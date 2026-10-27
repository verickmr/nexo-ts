import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { assertOrigin, route } from '@/lib/errors';
import { changeDraft, confirmDraft } from '@/services/drafts';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    assertOrigin(request);
    const actor = await requireUser('EMPLOYEE');
    const { action, version, data } = z
      .object({
        action: z.enum(['CONFIRM', 'EDIT', 'CANCEL']),
        version: z.number().int().nonnegative(),
        data: z.unknown().optional(),
      })
      .parse(await request.json());
    const { id } = await context.params;
    const result =
      action === 'CONFIRM'
        ? await confirmDraft(id, version, actor)
        : await changeDraft(id, actor, action, version, data);
    return Response.json({ ok: true, result });
  });
}
