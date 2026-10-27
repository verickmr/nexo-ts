import { AuthForm } from '@/components/auth-form';
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string }> }) { const { token } = await searchParams; return <AuthForm authMode={process.env.AUTH_MODE || 'demo'} token={token || 'missing'}/>; }
