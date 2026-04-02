CONFIGURAÇÃO DO SUPABASE

1. Abra o arquivo supabase.js
2. Preencha:
   const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
   const SUPABASE_KEY = "SUA_ANON_KEY";

SQL DA TABELA

create table if not exists chamados (
  id text primary key,
  nome text,
  unidade text,
  setor text,
  setor_problema text,
  tipo_manutencao text,
  gravidade text,
  descricao text,
  foto_url text,
  status text,
  data_criacao timestamptz,
  data_inicio timestamptz,
  data_finalizacao timestamptz
);

alter table chamados enable row level security;

create policy "public insert"
on chamados for insert to anon with check (true);

create policy "public select"
on chamados for select to anon using (true);

create policy "public update"
on chamados for update to anon using (true) with check (true);

STORAGE
- Criar bucket: chamados-fotos
- Permitir insert/select no bucket para anon, se desejar uso sem login

EXECUÇÃO LOCAL
python -m http.server 8000
