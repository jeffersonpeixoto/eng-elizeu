CONFIGURAÇÃO DO PWA E SUPABASE

1. Abra o arquivo supabase.js
2. Preencha:
   const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   const SUPABASE_KEY = "SUA_ANON_KEY";

3. Rode em servidor local:
   python -m http.server 8000

4. Abra:
   http://localhost:8000

IMPORTANTE
- O botão de instalar só aparece quando o navegador libera o evento beforeinstallprompt
- Use localhost ou HTTPS
- O manifest já possui ícones 192x192 e 512x512
- O Service Worker já está configurado
