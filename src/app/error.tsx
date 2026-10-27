'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="fatal-error"><h1>Não foi possível carregar.</h1><p>Confira a conexão com o banco e tente novamente.</p><button className="button primary" onClick={reset}>Tentar novamente</button></main>; }
