-- Supabase schema for NoteFlow

-- Table: public.notes
-- Uses gen_random_uuid() (available by default on Supabase) for UUIDs

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  class text not null,
  tags text default '',
  description text default '',
  image text default '',
  file_url text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_updated_at on public.notes;
create trigger trg_set_updated_at
before update on public.notes
for each row
execute function public.set_updated_at();

-- Row Level Security
alter table public.notes enable row level security;

-- Policies
-- Read: allow anyone to read notes (public site needs to list notes)
drop policy if exists "Allow read to all" on public.notes;
create policy "Allow read to all"
on public.notes
for select
to public
using (true);

-- Write: allow only authenticated users to insert/update/delete
drop policy if exists "Allow write to authenticated" on public.notes;
create policy "Allow write to authenticated"
on public.notes
for all
to authenticated
using (true)
with check (true);

/*
Production hardening ideas (optional):

-- 1) Restrict writes to a specific email domain or a list of admins:
--    Replace (true) with a check on auth.jwt() claims.
--    Example (domain):
--    with check (split_part(auth.jwt() ->> 'email', '@', 2) = 'yourdomain.com')
--
-- 2) Make notes owned by a user:
--    - Add created_by uuid references auth.users not null default auth.uid()
--    - Change policies to using (created_by = auth.uid()) and with check (created_by = auth.uid())
--
-- 3) If you want to keep some notes private, add a boolean column 'is_public' with default true
--    and modify the read policy to using (is_public = true).
*/
