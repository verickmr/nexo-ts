import nodemailer from 'nodemailer';
import { AppError } from '@/lib/errors';
export async function sendResetEmail(email: string, token: string) {
  if (!process.env.SMTP_HOST) throw new AppError(503, 'A recuperação de senha está temporariamente indisponível. Contate a TI.');
  const url = new URL('/redefinir-senha', process.env.APP_URL || 'http://localhost:3000');
  url.searchParams.set('token', token);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    connectionTimeout: 10000, socketTimeout: 15000
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'Nexo Assist <assist@nexo.example>', to: email,
    subject: 'Redefinir sua senha do Nexo Assist',
    text: `Recebemos um pedido para redefinir sua senha. Acesse ${url.toString()} em até 30 minutos. O link funciona uma única vez. Se não foi você, ignore esta mensagem.`
  });
}
