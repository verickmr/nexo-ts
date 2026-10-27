import { redirect } from 'next/navigation';
import { currentUser, publicUser } from '@/lib/auth';
import { Workspace } from './workspace';
export async function WorkspacePage({ mode }: { mode: 'chat' | 'profile' | 'analyst' }) {
  const user = await currentUser();
  if (!user) redirect('/entrar');
  if (mode === 'analyst' && user.role !== 'ANALYST') redirect('/atendimento');
  if (mode === 'chat' && user.role === 'ANALYST') redirect('/analista');
  return (
    <Workspace
      user={publicUser(user)}
      mode={mode}
      config={{
        authMode: process.env.AUTH_MODE || 'demo',
        aiMode: process.env.AI_MODE || 'groq',
        aiConfigured: !!process.env.GROQ_API_KEY,
      }}
    />
  );
}
