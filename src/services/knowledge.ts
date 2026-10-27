import { db } from '@/lib/db';
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const stopWords = new Set([
  'como',
  'com',
  'das',
  'dos',
  'esta',
  'estao',
  'meu',
  'meus',
  'minha',
  'minhas',
  'nao',
  'nos',
  'para',
  'pelo',
  'pela',
  'por',
  'preciso',
  'qual',
  'quais',
  'que',
  'quero',
  'sem',
  'seu',
  'sua',
  'tem',
  'uma',
  'uns',
]);
const tokens = (text: string) =>
  normalize(text)
    .replace(/wi-fi/g, 'wifi')
    .split(/\W+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
export async function searchArticles(query: string, os: string) {
  const terms = [...new Set(tokens(query))];
  const articles = await db.article.findMany();
  return articles
    .map((article) => {
      const headings = new Set(tokens(`${article.title} ${article.keywords.join(' ')}`));
      const body = new Set(tokens(article.body));
      const score = terms.reduce(
        (total, term) => total + (headings.has(term) ? 3 : body.has(term) ? 1 : 0),
        0,
      );
      return {
        ...article,
        applicable: !article.applicableOs.length || article.applicableOs.includes(os),
        score,
      };
    })
    .filter((a) => a.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
