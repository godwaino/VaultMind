-- VaultMind — storage bucket for encrypted backup blobs (ARCHITECTURE §4.2/§4.1)
-- Layout: backups/{user_id}/...  — CIPHERTEXT ONLY (client-side AES-256-GCM).
-- The bucket is private; objects are reached via short-lived signed URLs issued by
-- /api/backup/* after JWT + entitlement checks. RLS on storage.objects additionally
-- pins every object to its owner's folder.

begin;

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- Owner-only access, scoped to a top-level folder named after the user's id.
-- storage.foldername(name)[1] is the first path segment, i.e. {user_id}.
create policy "backups_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backups_owner_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backups_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "backups_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backups' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
