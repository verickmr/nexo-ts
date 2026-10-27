import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { searchArticles } from '@/services/knowledge';

vi.mock('@/lib/db', () => ({ db: { article: { findMany: vi.fn() } } }));

beforeEach(() => {
  vi.mocked(db.article.findMany).mockResolvedValue([
    {
      id: 'horario',
      title: 'Horário do service desk e plantão',
      body: 'O service desk atende de segunda a sexta, das 8h às 18h. Plantão 24 horas.',
      keywords: ['horário', 'atendimento', 'plantão'],
      applicableOs: [],
    },
    {
      id: 'senha',
      title: 'Redefinir a senha da rede',
      body: 'Acesse o portal corporativo e escolha Esqueci minha senha.',
      keywords: ['senha', 'bloqueada', 'rede'],
      applicableOs: [],
    },
    {
      id: 'vpn809',
      title: 'VPN com erro 809 no Windows 10',
      body: 'Reinstale o cliente de VPN no Windows 10.',
      keywords: ['vpn', '809', 'conexão'],
      applicableOs: ['Windows 10'],
    },
  ]);
});

describe('Busca de orientações aplicáveis', () => {
  it('encontra o horário com palavras do corpo e evita a coincidência entre que e bloqueada', async () => {
    const articles = await searchArticles('Que horas o suporte atende?', 'Windows 11');
    expect(articles.map((article) => article.id)).toEqual(['horario']);
  });

  it('não trata palavras comuns como evidência de relevância', async () => {
    expect(await searchArticles('Como que eu faço para isso?', 'Windows 11')).toEqual([]);
  });

  it('normaliza acentos e preserva a restrição por sistema operacional', async () => {
    expect((await searchArticles('Qual o horario de atendimento?', 'Windows 11'))[0].id).toBe(
      'horario',
    );
    expect((await searchArticles('VPN erro 809', 'Windows 11'))[0]).toMatchObject({
      id: 'vpn809',
      applicable: false,
    });
    expect((await searchArticles('VPN erro 809', 'Windows 10'))[0]).toMatchObject({
      id: 'vpn809',
      applicable: true,
    });
  });
});
