-- Simula o mínimo do Supabase (auth, papéis e publicação) para testar supabase/schema.sql num Postgres comum
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
grant execute on all functions in schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
create publication supabase_realtime;
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','den@x.com'),('00000000-0000-0000-0000-00000000000b','hev@x.com'),('00000000-0000-0000-0000-00000000000c','estranho@x.com');
