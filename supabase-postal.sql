-- ใบนำส่งไปรษณีย์ (postal.html): ให้ทุกคนที่เปิดลิงก์บันทึก/ดู/ลบใบนำส่งได้โดยไม่ต้องเข้าสู่ระบบ
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run (ทำครั้งเดียว)
--
-- เปิดสิทธิ์ให้เฉพาะแถวที่ id ขึ้นต้นด้วย "postal:" (ใบนำส่ง) เท่านั้น
-- ข้อมูลชุดเบิกในระบบติดตามยังต้องเข้าสู่ระบบเหมือนเดิม
-- หมายเหตุ: ใครก็ตามที่ได้ลิงก์ใบนำส่งไป จะดู แก้ หรือลบใบนำส่งได้

drop policy if exists "postal slips: anyone reads"   on public.docsets;
drop policy if exists "postal slips: anyone adds"    on public.docsets;
drop policy if exists "postal slips: anyone edits"   on public.docsets;
drop policy if exists "postal slips: anyone deletes" on public.docsets;

create policy "postal slips: anyone reads"   on public.docsets for select to anon using (id like 'postal:%');
create policy "postal slips: anyone adds"    on public.docsets for insert to anon with check (id like 'postal:%');
create policy "postal slips: anyone edits"   on public.docsets for update to anon using (id like 'postal:%') with check (id like 'postal:%');
create policy "postal slips: anyone deletes" on public.docsets for delete to anon using (id like 'postal:%');
