-- ระบบติดตามเอกสารชุดเบิก: ตารางและกฎความปลอดภัยใน Supabase
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run

create table if not exists public.docsets (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- ไม่มีการเข้าสู่ระบบ: ใครก็ได้ที่เปิดหน้าเว็บ อ่าน เพิ่ม แก้ และลบข้อมูลได้ทั้งหมด
alter table public.docsets enable row level security;

drop policy if exists "signed-in users read" on public.docsets;
drop policy if exists "signed-in users add" on public.docsets;
drop policy if exists "signed-in users edit" on public.docsets;
drop policy if exists "signed-in users delete" on public.docsets;
drop policy if exists "anyone reads" on public.docsets;
drop policy if exists "anyone adds" on public.docsets;
drop policy if exists "anyone edits" on public.docsets;
drop policy if exists "anyone deletes" on public.docsets;

create policy "anyone reads"   on public.docsets for select to anon, authenticated using (true);
create policy "anyone adds"    on public.docsets for insert to anon, authenticated with check (true);
create policy "anyone edits"   on public.docsets for update to anon, authenticated using (true) with check (true);
create policy "anyone deletes" on public.docsets for delete to anon, authenticated using (true);

-- ให้หน้าเว็บทุกเครื่องเห็นการเปลี่ยนแปลงทันที
do $$ begin
  alter publication supabase_realtime add table public.docsets;
exception when duplicate_object then null; end $$;
