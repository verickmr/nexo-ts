import { ZodError } from 'zod';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'APP_ERROR',
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      {
        error: 'Confira os campos informados.',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    );
  console.error(
    '[nexo] Falha interna:',
    error instanceof Error
      ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database]')
      : 'unknown',
  );
  return Response.json(
    { error: 'Não foi possível concluir agora. Tente novamente.', code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}
export async function route(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    return errorResponse(error);
  }
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(process.env.APP_URL || request.url).origin;
  if (origin && origin !== expected) throw new AppError(403, 'Origem da solicitação inválida.');
}
