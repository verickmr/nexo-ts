import { db } from '@/lib/db';
const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
export async function searchArticles(query: string, os: string) {
  const terms = normalize(query).split(/\W+/).filter(s => s.length > 2);
  const articles = await db.article.findMany();
  return articles.map(article => {
    const text = normalize(`${article.title} ${article.keywords.join(' ')}`);
    const score = terms.filter(term => text.includes(term)).length;
    return { ...article, applicable: !article.applicableOs.length || article.applicableOs.includes(os), score };
  }).filter(a => a.score > 0).sort((a,b) => b.score - a.score).slice(0, 3);
}
