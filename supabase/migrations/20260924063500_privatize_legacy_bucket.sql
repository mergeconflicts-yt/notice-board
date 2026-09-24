-- The legacy `notes` bucket stays public only while it still holds files.
-- Once its contents have been migrated into board-media (see the file
-- migration runbook), an empty bucket is flipped private automatically.
-- Populated buckets are left alone so old URLs keep working until moved.
update storage.buckets
set public = false
where id = 'notes'
  and public = true
  and not exists (select 1 from storage.objects where bucket_id = 'notes');
