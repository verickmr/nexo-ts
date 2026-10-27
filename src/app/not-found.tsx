import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="fatal-error">
      <h1>Página não encontrada.</h1>
      <Link className="button primary" href="/">
        Voltar ao Nexo Assist
      </Link>
    </main>
  );
}
