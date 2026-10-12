-- ระบบติดตามเอกสารชุดเบิก: ตารางและกฎความปลอดภัยใน Supabase
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run

create table if not exists public.docsets (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- เปิด Row Level Security: ไม่มีนโยบายสำหรับ anon จึงไม่มีใครอ่านหรือเขียนได้ถ้ายังไม่เข้าสู่ระบบ
alter table public.docsets enable row level security;

drop policy if exists "signed-in users read" on public.docsets;
drop policy if exists "signed-in users add" on public.docsets;
drop policy if exists "signed-in users edit" on public.docsets;
drop policy if exists "signed-in users delete" on public.docsets;

create policy "signed-in users read"   on public.docsets for select to authenticated using (true);
create policy "signed-in users add"    on public.docsets for insert to authenticated with check (true);
create policy "signed-in users edit"   on public.docsets for update to authenticated using (true) with check (true);
create policy "signed-in users delete" on public.docsets for delete to authenticated using (true);

-- ให้หน้าเว็บทุกเครื่องเห็นการเปลี่ยนแปลงทันที
do $$ begin
  alter publication supabase_realtime add table public.docsets;
exception when duplicate_object then null; end $$;
