const url = process.argv[2] || 'http://localhost:3000/api/health';
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (response.ok) { ready = true; break; }
  } catch { /* Startup may not have opened the port yet. */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!ready) { console.error('O servidor não ficou pronto:', url); process.exitCode = 1; }
else console.log('Servidor pronto:', url);
