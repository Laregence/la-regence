-- ============================================================
-- Bons cadeaux : utilisation en plusieurs fois (solde)
-- À exécuter UNE FOIS dans Supabase > SQL Editor,
-- APRÈS supabase/bons_cadeaux.sql
-- ============================================================

-- 1. Solde restant sur chaque bon
alter table public.bons_cadeaux add column if not exists solde_cents integer;

update public.bons_cadeaux
set solde_cents = case when statut = 'utilise' then 0 else montant_cents end
where solde_cents is null;

alter table public.bons_cadeaux
  alter column solde_cents set not null,
  drop constraint if exists bons_cadeaux_solde_check,
  add constraint bons_cadeaux_solde_check check (solde_cents >= 0 and solde_cents <= montant_cents);

-- 2. Historique des utilisations
create table if not exists public.bons_cadeaux_utilisations (
  id             uuid primary key default gen_random_uuid(),
  bon_id         uuid not null references public.bons_cadeaux(id) on delete cascade,
  montant_cents  integer not null check (montant_cents > 0),
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);

create index if not exists bons_utilisations_bon_idx on public.bons_cadeaux_utilisations (bon_id);

alter table public.bons_cadeaux_utilisations enable row level security;

drop policy if exists "bons_util_admin_select" on public.bons_cadeaux_utilisations;
create policy "bons_util_admin_select" on public.bons_cadeaux_utilisations
  for select to authenticated using (true);

-- 3. Débiter un bon (verrouille la ligne : pas de double débit possible)
create or replace function public.utiliser_bon(p_bon_id uuid, p_montant_cents integer, p_note text default null)
returns public.bons_cadeaux
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bons_cadeaux;
begin
  if auth.uid() is null then
    raise exception 'Non autorisé';
  end if;
  if p_montant_cents is null or p_montant_cents <= 0 then
    raise exception 'Montant invalide';
  end if;

  select * into b from public.bons_cadeaux where id = p_bon_id for update;
  if not found then
    raise exception 'Bon introuvable';
  end if;
  if b.statut <> 'paye' then
    raise exception 'Ce bon n''est pas utilisable (statut : %)', b.statut;
  end if;
  if p_montant_cents > b.solde_cents then
    raise exception 'Montant supérieur au solde restant (% €)', to_char(b.solde_cents / 100.0, 'FM999990D00');
  end if;

  insert into public.bons_cadeaux_utilisations (bon_id, montant_cents, note, created_by)
  values (b.id, p_montant_cents, nullif(trim(p_note), ''), auth.jwt() ->> 'email');

  update public.bons_cadeaux
  set solde_cents = solde_cents - p_montant_cents,
      statut      = case when solde_cents - p_montant_cents = 0 then 'utilise' else statut end,
      utilise_le  = case when solde_cents - p_montant_cents = 0 then now() else utilise_le end
  where id = b.id
  returning * into b;

  return b;
end;
$$;

-- 4. Annuler une utilisation (erreur de saisie) : recrédite le solde
create or replace function public.annuler_utilisation_bon(p_utilisation_id uuid)
returns public.bons_cadeaux
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.bons_cadeaux_utilisations;
  b public.bons_cadeaux;
begin
  if auth.uid() is null then
    raise exception 'Non autorisé';
  end if;

  select * into u from public.bons_cadeaux_utilisations where id = p_utilisation_id;
  if not found then
    raise exception 'Utilisation introuvable';
  end if;

  select * into b from public.bons_cadeaux where id = u.bon_id for update;
  if b.statut not in ('paye', 'utilise') then
    raise exception 'Ce bon ne peut pas être modifié (statut : %)', b.statut;
  end if;

  delete from public.bons_cadeaux_utilisations where id = u.id;

  update public.bons_cadeaux
  set solde_cents = solde_cents + u.montant_cents,
      statut      = 'paye',
      utilise_le  = null
  where id = b.id
  returning * into b;

  return b;
end;
$$;

revoke all on function public.utiliser_bon(uuid, integer, text) from public, anon;
revoke all on function public.annuler_utilisation_bon(uuid) from public, anon;
grant execute on function public.utiliser_bon(uuid, integer, text) to authenticated;
grant execute on function public.annuler_utilisation_bon(uuid) to authenticated;
