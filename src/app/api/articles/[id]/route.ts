import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { AppError, route } from '@/lib/errors';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    await requireUser();
    const article = await db.article.findUnique({ where: { id: (await context.params).id } });
    if (!article) throw new AppError(404, 'Artigo não encontrado.');
    return Response.json(article);
  });
}
