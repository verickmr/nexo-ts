import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { db } from '../src/lib/db';
import { hashPassword, hashToken } from '../src/lib/auth';
const base=process.env.TEST_PASSWORD_BASE_URL||'http://localhost:3001';
const mail=process.env.TEST_MAILPIT_URL||'http://localhost:8025';
const id=`password-test-${randomUUID()}`; const email=`${id}@example.test`;
async function post(path:string,data:unknown){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});}
async function main(){
  await db.user.create({data:{id,name:'Teste de recuperação',email,department:'Testes',passwordHash:await hashPassword('Senha-Inicial-De-Teste')}});
  const login=await post('/api/auth/login',{email,password:'Senha-Inicial-De-Teste'});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await fetch(base+'/api/conversations',{headers:{Cookie:cookie}})).status,200);
  assert.equal((await post('/api/auth/forgot-password',{email})).status,200);
  let messageId:string|undefined;
  for(let attempt=0;attempt<10;attempt++){
    const mailbox=await(await fetch(mail+'/api/v1/messages',{signal:AbortSignal.timeout(5000)})).json();
    messageId=mailbox.messages?.find((m:{To:{Address:string}[]})=>m.To?.some(to=>to.Address===email))?.ID;
    if(messageId)break;await new Promise(resolve=>setTimeout(resolve,300));
  }
  assert.ok(messageId,'O e-mail de recuperação precisa chegar ao Mailpit.');
  const message=await(await fetch(mail+`/api/v1/message/${messageId}`)).json();
  const match=(message.Text as string).match(/https?:\/\/[^\s]+\/redefinir-senha\?token=[^\s]+/);assert.ok(match);
  const token=new URL(match[0]).searchParams.get('token');assert.ok(token);
  assert.equal((await post('/api/auth/reset-password',{token,password:'Nova-Senha-De-Teste-2026'})).status,200);
  assert.equal((await fetch(base+'/api/conversations',{headers:{Cookie:cookie}})).status,401,'Sessão anterior deve ser revogada.');
  assert.equal((await post('/api/auth/reset-password',{token,password:'Outra-Senha-De-Teste-2026'})).status,400,'Token não pode ser reutilizado.');
  assert.equal((await post('/api/auth/login',{email,password:'Senha-Inicial-De-Teste'})).status,401);
  assert.equal((await post('/api/auth/login',{email,password:'Nova-Senha-De-Teste-2026'})).status,200);
  const expired=randomUUID()+randomUUID();await db.resetToken.create({data:{userId:id,tokenHash:hashToken(expired),expiresAt:new Date(Date.now()-1000)}});
  assert.equal((await post('/api/auth/reset-password',{token:expired,password:'Outra-Senha-De-Teste-2026'})).status,400);
  console.log('PASS: e-mail entregue, redefinição real, token de uso único/expiração e revogação de sessões.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{await db.user.deleteMany({where:{id}});await db.$disconnect();});
