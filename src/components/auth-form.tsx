'use client';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, ShieldCheck, ArrowLeft, Check, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Logo, Badge, Modal, Spinner, api } from './ui';
import type { PublicUser } from '@/domain/types';
export function AuthForm({ authMode, token }: { authMode: string; token?: string }) {
  const [email, setEmail] = useState(authMode === 'demo' ? 'ana.souza@nexo.com.br' : '');
  const [password, setPassword] = useState(''); const [remember, setRemember] = useState(false);
  const [visible, setVisible] = useState(false); const [screen, setScreen] = useState(token ? 'reset' : 'login');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [info, setInfo] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (screen === 'forgot') {
        const data = await api<{ message: string }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setNotice(data.message);
      } else if (screen === 'reset') {
        await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }); setScreen('success');
      } else {
        const data = await api<{ user: PublicUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) });
        router.push(data.user.role === 'ANALYST' ? '/analista' : '/atendimento'); router.refresh();
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const switchScreen = (next: string) => { setScreen(next); setError(''); setNotice(''); };
  return <div className="auth-layout">
    <section className="auth-showcase"><Logo light/>
      <div className="auth-story"><div className="eyebrow">Service desk de TI da Nexo</div><h1>Seu problema de TI,<br/>resolvido em uma<br className="desktop-break"/> conversa.</h1><p className="auth-description">Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de ajuda e chama um analista quando precisa.</p>
        <div className="showcase-chat"><div className="showcase-user">Meu notebook não conecta na VPN. Erro 809.</div><div className="showcase-agent"><Logo light compact/><div><strong>Nexo Assist</strong><div className="showcase-actions">consultou seus chamados · criou um chamado</div><p>Pronto: abri o chamado com prioridade alta. Um analista responde em até 4 h úteis.</p><div className="showcase-ticket"><span className="ticket-dot"/><div><strong>INC-20517</strong><span>Rede e VPN · Alta · em até 4 h úteis</span></div><ArrowRight size={17}/></div></div></div><small>Exemplo de atendimento</small></div>
      </div>
      <div className="auth-stats"><div><strong>30</strong><span>mensagens por sessão</span></div><div><strong>6</strong><span>categorias de atendimento</span></div><div><strong>24h</strong><span>plantão para casos críticos</span></div></div>
    </section>
    <section className="auth-main"><div className="auth-help">Problema para entrar? <a href="tel:4000">Ligue no ramal 4000</a></div>
      <div className="auth-center"><div className="auth-form-wrap">
        {screen !== 'login' && <button className="text-button back-link" onClick={() => { switchScreen('login'); router.replace('/entrar'); }}><ArrowLeft size={15}/> Voltar para entrar</button>}
        {screen === 'success' ? <><div className="success-icon"><Check/></div><h2>Senha redefinida.</h2><p className="auth-subtitle">Sua nova senha está pronta. Entre novamente para continuar o atendimento.</p><button className="button primary full" onClick={() => { switchScreen('login'); router.replace('/entrar'); }}>Voltar para entrar <ArrowRight size={17}/></button></> : <>
          <div className="auth-heading"><h2>{screen === 'forgot' ? 'Esqueceu sua senha?' : screen === 'reset' ? 'Crie uma nova senha.' : 'Entrar'}</h2><p className="auth-subtitle">{screen === 'forgot' ? 'Informe seu e-mail corporativo para receber as instruções.' : screen === 'reset' ? 'Use ao menos 12 caracteres para proteger sua conta.' : 'Use seu e-mail corporativo e a senha da rede Nexo.'}</p></div>
          <form onSubmit={submit} className="auth-form">
            {screen !== 'reset' && <label className="field">E-mail corporativo<input type="email" name="email" value={email} autoComplete="email" placeholder="seu.nome@nexo.com.br" required onChange={e => setEmail(e.target.value)}/></label>}
            {screen !== 'forgot' && <label className="field" htmlFor="auth-password"><span className="field-label">{screen === 'reset' ? 'Nova senha' : 'Senha'}{screen === 'login' && <button type="button" className="text-button" onClick={() => switchScreen('forgot')}>Esqueci minha senha</button>}</span><span className="password-field"><input id="auth-password" aria-label={screen === 'reset' ? 'Nova senha' : 'Senha'} name="password" type={visible ? 'text' : 'password'} value={password} minLength={screen === 'reset' ? 12 : 1} maxLength={200} autoComplete={screen === 'reset' ? 'new-password' : 'current-password'} placeholder={screen === 'reset' ? 'No mínimo 12 caracteres' : 'Sua senha'} required onChange={e => setPassword(e.target.value)}/><button type="button" className="icon-button" aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>}
            {screen === 'login' && <label className="checkbox-row"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/> Manter conectado neste computador</label>}
            {error && <div role="alert" className="alert error">{error}</div>}{notice && <div role="status" className="alert success"><Mail size={17}/>{notice}</div>}
            <button type="submit" className="button primary full auth-submit" disabled={busy}>{busy ? <Spinner/> : screen === 'forgot' ? 'Enviar link de redefinição' : screen === 'reset' ? 'Salvar nova senha' : 'Entrar'}{!busy && <ArrowRight size={17}/>}</button>
          </form>
          {authMode === 'demo' && screen === 'login' && <div className="demo-access"><div><ShieldCheck size={15}/><strong>Ambiente de demonstração</strong></div><p>Use qualquer senha e um dos acessos abaixo.</p><div className="demo-accounts"><button onClick={() => setEmail('ana.souza@nexo.com.br')}>Ana · Funcionária</button><button onClick={() => setEmail('rafael.lima@nexo.com.br')}>Rafael · Analista</button><button onClick={() => setEmail('carla.mendes@nexo.com.br')}>Carla · Funcionária</button></div></div>}
        </>}
      </div></div>
      <footer className="auth-footer"><span>© 2026 Nexo · Service desk de TI</span><button className="text-button" onClick={() => setInfo(true)}>Privacidade e uso de dados</button></footer>
    </section>
    {info && <Modal title="Privacidade e uso de dados" onClose={() => setInfo(false)}><div className="modal-body prose"><p>O Nexo Assist usa as mensagens para orientar o atendimento de TI, consultar seus chamados e preparar solicitações para sua confirmação.</p><p>Funcionários acessam apenas seus próprios chamados. Analistas autorizados acessam os atendimentos no console. Não envie senhas ou informações sensíveis pelo chat.</p><p>As mensagens podem ser processadas pelo provedor de IA configurado. No ambiente de demonstração, os funcionários e chamados iniciais são fictícios.</p><Badge tone="blue">Projeto demonstrativo</Badge></div></Modal>}
  </div>;
}
