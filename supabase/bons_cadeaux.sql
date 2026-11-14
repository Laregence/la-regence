-- ============================================================
-- Bons cadeaux (achat en ligne via Stripe)
-- À exécuter UNE FOIS dans Supabase > SQL Editor
-- ============================================================

create table if not exists public.bons_cadeaux (
  id                     uuid primary key default gen_random_uuid(),
  code                   text unique,               -- ex : REG-7KQ4-M2XP (attribué après paiement)
  montant_cents          integer not null check (montant_cents between 1000 and 100000),
  acheteur_nom           text not null,
  acheteur_email         text not null,
  beneficiaire_nom       text,
  beneficiaire_email     text,
  message                text,
  envoyer_au_beneficiaire boolean not null default false,
  statut                 text not null default 'en_attente'
                         check (statut in ('en_attente', 'paye', 'utilise', 'annule')),
  stripe_session_id      text unique,
  stripe_payment_intent  text,
  paye_le                timestamptz,
  expire_le              date,
  utilise_le             timestamptz,
  note_admin             text,
  created_at             timestamptz not null default now()
);

create index if not exists bons_cadeaux_statut_idx on public.bons_cadeaux (statut);

alter table public.bons_cadeaux enable row level security;

-- Aucun accès public : les créations passent par les fonctions Netlify (clé secrète).
-- Les admins connectés peuvent consulter et mettre à jour.
drop policy if exists "bons_admin_select" on public.bons_cadeaux;
create policy "bons_admin_select" on public.bons_cadeaux
  for select to authenticated using (true);

drop policy if exists "bons_admin_update" on public.bons_cadeaux;
create policy "bons_admin_update" on public.bons_cadeaux
  for update to authenticated using (true) with check (true);
