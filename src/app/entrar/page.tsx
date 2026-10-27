import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth-form';
export default async function Login() {
  const user = await currentUser();
  if (user) redirect(user.role === 'ANALYST' ? '/analista' : '/atendimento');
  return <AuthForm authMode={process.env.AUTH_MODE || 'demo'} />;
}
