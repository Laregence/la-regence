-- ============================================================
-- Mises en avant (pop-up de la page d'accueil)
-- À exécuter UNE FOIS dans Supabase > SQL Editor
-- ============================================================

-- 1. Table
create table if not exists public.mises_en_avant (
  id          uuid primary key default gen_random_uuid(),
  titre       text,
  texte       text,
  image_url   text,
  image_path  text,               -- chemin dans le bucket (pour suppression)
  lien_url    text,               -- ex : /reservation/
  lien_label  text,               -- ex : Réserver une table
  actif       boolean not null default true,
  date_debut  date,               -- vide = dès maintenant
  date_fin    date,               -- vide = sans fin
  ordre       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.mises_en_avant enable row level security;

-- Le public ne voit que les mises en avant actives
drop policy if exists "mea_public_read" on public.mises_en_avant;
create policy "mea_public_read" on public.mises_en_avant
  for select to anon
  using (actif = true);

-- Les admins connectés gèrent tout
drop policy if exists "mea_admin_all" on public.mises_en_avant;
create policy "mea_admin_all" on public.mises_en_avant
  for all to authenticated
  using (true) with check (true);

-- 2. Stockage des images (bucket public)
insert into storage.buckets (id, name, public)
values ('mises-en-avant', 'mises-en-avant', true)
on conflict (id) do update set public = true;

drop policy if exists "mea_img_public_read" on storage.objects;
create policy "mea_img_public_read" on storage.objects
  for select using (bucket_id = 'mises-en-avant');

drop policy if exists "mea_img_admin_insert" on storage.objects;
create policy "mea_img_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'mises-en-avant');

drop policy if exists "mea_img_admin_update" on storage.objects;
create policy "mea_img_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'mises-en-avant');

drop policy if exists "mea_img_admin_delete" on storage.objects;
create policy "mea_img_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'mises-en-avant');
