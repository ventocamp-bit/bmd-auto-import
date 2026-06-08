create extension if not exists pgcrypto;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  original_name text not null,
  mime_type text not null,
  file_path text,
  file_size bigint,
  status text not null default 'new'
    check (status in ('new', 'processing', 'review', 'success', 'error')),
  manufacturer text,
  extracted_data jsonb not null default '{}'::jsonb,
  uncertainties jsonb not null default '{}'::jsonb,
  error_message text,
  export_path text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_created_at_idx on public.documents (created_at desc);
create index if not exists documents_user_id_idx on public.documents (user_id);

grant usage on schema public to service_role;
grant all privileges on table public.documents to service_role;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values
  ('coc-documents', 'coc-documents', false),
  ('coc-exports', 'coc-exports', false)
on conflict (id) do nothing;

alter table public.documents enable row level security;

-- Policy for service role (admins/system/webhooks)
drop policy if exists "service role manages documents" on public.documents;
create policy "service role manages documents"
on public.documents
for all
to service_role
using (true)
with check (true);

-- Policy for authenticated users (regular tenants)
drop policy if exists "users manage own documents" on public.documents;
create policy "users manage own documents"
on public.documents
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
