-- Signed-in users can read and change records; row-level security limits
-- them to their own rows. Signed-out visitors get no access at all.
grant select, insert, update, delete on public.records to authenticated;
revoke all on public.records from anon;
revoke truncate, references, trigger on public.records from authenticated;
