-- Shop page (docs/SHOP.md): categories, card flags, store-product overrides
-- and one server-side visibility function.
--
-- ADD-ONLY migration (migration freeze in effect since the 2026-09-28 push).
-- Prices never live here: the catalogue only names the store product to sell.
--
-- The brief's `shop_categories` sketch has no `regions` column, but §3.2
-- requires rule 4 (regions) to apply to categories. Added `regions` so the
-- rule is implementable; see docs/backend-plan-questions.md ("Shop page").
--
-- Draft catalogue rows are visible only to testers. There was no existing
-- allow-list in this project, so this migration adds a tiny `shop_testers`
-- table (no client grants; populated by an admin script / service role).

-- ---------------------------------------------------------------------------
-- Categories = the sections and chips on the shop page.
-- ---------------------------------------------------------------------------

create table public.shop_categories (
  id              text primary key,
  title           text not null,
  chip_label      text,
  card_tag        text,
  layout          text not null default 'grid' check (layout in ('grid', 'row')),
  sort            integer not null default 100,
  status          text not null default 'draft' check (status in ('draft', 'live', 'retired')),
  available_from  timestamptz,
  available_until timestamptz,
  regions         text[]
);
create index shop_categories_sort_idx on public.shop_categories (sort);

-- Tester allow-list for draft catalogue rows (PRD §9.1). Never client-writable.
create table public.shop_testers (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pack_catalog
  add column category_id           text references public.shop_categories (id),
  add column featured              boolean not null default false,
  add column card_art              text[],
  add column card_bg               text,
  add column card_tag              text,
  add column badge_text            text,
  add column sale_store_product_id text,
  add column sale_from             timestamptz,
  add column sale_until            timestamptz,
  add column sale_label            text,
  add column regions               text[];

alter table public.pack_art
  add column status text not null default 'live' check (status in ('draft', 'live', 'retired')),
  add column sort   integer not null default 100;

create index pack_catalog_category_idx on public.pack_catalog (category_id);
create index pack_art_pack_live_idx on public.pack_art (pack_id, status, sort);

-- ---------------------------------------------------------------------------
-- RLS / grants
-- ---------------------------------------------------------------------------

alter table public.shop_categories enable row level security;
alter table public.shop_testers enable row level security;

revoke all on public.shop_categories from public, anon, authenticated;
revoke all on public.shop_testers from public, anon, authenticated;

grant select on public.shop_categories to authenticated;

create function public.is_shop_tester()
returns boolean
language sql
stable
security definer
set search_path = '' as $$
  select exists (
    select 1 from public.shop_testers where user_id = auth.uid()
  );
$$;

revoke all on function public.is_shop_tester() from public, anon;
grant execute on function public.is_shop_tester() to authenticated;

-- Live categories are readable directly; drafts stay behind get_shop() for
-- testers. (pack_catalog / pack_art keep their existing read rules.)
create policy shop_categories_select on public.shop_categories
  for select to authenticated
  using (status = 'live' or public.is_shop_tester());

-- ---------------------------------------------------------------------------
-- get_shop(p_renderer, p_region)
--
-- One server-side function decides visibility, sorting, item counts and the
-- card data. The app only filters the Owned chip locally.
--
-- A pack is visible when:
--   * it is live, or draft and the caller is a tester;
--   * now() is inside available_from/available_until (null = no limit);
--   * min_renderer <= p_renderer;
--   * regions is null or contains p_region;
--   * its category is visible; and
--   * it is not a bundle (featured bundles are returned for the offer).
-- ---------------------------------------------------------------------------

create function public.get_shop(p_renderer integer, p_region text)
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
with params as (
  select
    coalesce(p_renderer, 1) as renderer,
    nullif(upper(btrim(coalesce(p_region, ''))), '') as region,
    public.is_shop_tester() as tester,
    now() as at
),
category_base as (
  select c.*
  from public.shop_categories c, params p
  where (c.status = 'live' or (c.status = 'draft' and p.tester))
    and (c.available_from is null or c.available_from <= p.at)
    and (c.available_until is null or c.available_until > p.at)
    and (c.regions is null or (p.region is not null and p.region = any(c.regions)))
),
pack_base as (
  select pc.*
  from public.pack_catalog pc, params p
  where (pc.status = 'live' or (pc.status = 'draft' and p.tester))
    and (pc.available_from is null or pc.available_from <= p.at)
    and (pc.available_until is null or pc.available_until > p.at)
    and pc.min_renderer <= p.renderer
    and (pc.regions is null or (p.region is not null and p.region = any(pc.regions)))
    and (pc.kind <> 'bundle' or pc.featured)
),
pack_cards as (
  select pb.*, c.sort as cat_sort, c.card_tag as category_card_tag, false as hidden
  from pack_base pb
  left join category_base c on c.id = pb.category_id
),
visible_categories as (
  select c.*
  from category_base c
  where exists (
    select 1
    from pack_cards pc
    where pc.category_id = c.id and pc.kind <> 'bundle'
  )
),
visible_packs as (
  select pc.*
  from pack_cards pc
  where (pc.kind <> 'bundle' and pc.category_id in (select id from visible_categories))
     or (pc.kind = 'bundle' and pc.featured)
),
-- The Owned chip is the one place hidden packs may appear (retired, past
-- available_until, no longer in a visible category). Those rows are flagged
-- hidden so All/category sections can exclude them without a second request.
pack_union as (
  select * from visible_packs
  union all
  select pc.*, c.sort as cat_sort, c.card_tag as category_card_tag, true as hidden
  from public.pack_catalog pc
  cross join params p
  left join category_base c on c.id = pc.category_id
  where pc.kind <> 'bundle'
    and pc.min_renderer <= p.renderer
    and (
      pc.store_product_id is null
      or exists (
        select 1
        from public.user_entitlements e
        where e.user_id = auth.uid()
          and e.pack_id = pc.id
          and e.revoked_at is null
      )
    )
    and not exists (select 1 from visible_packs vp where vp.id = pc.id)
),
pack_json as (
  select
    pc.id,
    coalesce(pc.cat_sort, 0) as cat_sort,
    pc.sort,
    jsonb_build_object(
      'id', pc.id,
      'categoryId', pc.category_id,
      'kind', pc.kind,
      'name', pc.name,
      'blurb', pc.blurb,
      'storeProductId', pc.store_product_id,
      'saleStoreProductId', case when s.sale_active then pc.sale_store_product_id else null end,
      'saleUntil', case when s.sale_active then pc.sale_until else null end,
      'saleLabel', case when s.sale_active then pc.sale_label else null end,
      'priceLabel', pc.price_label,
      'availableUntil', pc.available_until,
      'badgeText', pc.badge_text,
      'cardArt', ca.card_art,
      'cardBg', pc.card_bg,
      'cardTag', coalesce(pc.card_tag, pc.category_card_tag),
      'itemCount', (
        select count(*)::integer
        from public.pack_art a
        where a.pack_id = pc.id
          and a.status = 'live'
          and a.kind in ('magnet', 'sticker', 'paper')
      ),
      'bundleOf', to_jsonb(pc.bundle_of),
      'bundleItems', bi.bundle_items,
      'featured', pc.featured,
      'hidden', pc.hidden,
      'owned', (
        pc.kind <> 'bundle'
        and (
          pc.store_product_id is null
          or exists (
            select 1
            from public.user_entitlements e
            where e.user_id = auth.uid()
              and e.pack_id = pc.id
              and e.revoked_at is null
          )
        )
      )
    ) as obj
  from pack_union pc
  cross join params p
  cross join lateral (
    select
      pc.sale_store_product_id is not null
      and (pc.sale_from is null or pc.sale_from <= p.at)
      and (pc.sale_until is null or pc.sale_until > p.at) as sale_active
  ) s
  cross join lateral (
    select case
      when pc.card_art is not null and cardinality(pc.card_art) > 0 then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'artId', a.art_id,
              'packId', a.pack_id,
              'kind', a.kind,
              'label', a.label,
              'path', a.path
            ) order by u.ord
          ),
          '[]'::jsonb
        )
        from unnest(pc.card_art) with ordinality as u(art_id, ord)
        join public.pack_art a on a.art_id = u.art_id
        where u.ord <= 2
      )
      else (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'artId', a.art_id,
              'packId', a.pack_id,
              'kind', a.kind,
              'label', a.label,
              'path', a.path
            ) order by a.sort, a.art_id
          ),
          '[]'::jsonb
        )
        from (
          select *
          from public.pack_art
          where pack_id = pc.id and status = 'live' and kind = 'magnet'
          order by sort, art_id
          limit 2
        ) a
      )
    end as card_art
  ) ca
  cross join lateral (
    select case
      when pc.kind = 'bundle' and pc.featured then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', b.id,
              'name', b.name,
              'kind', b.kind,
              'storeProductId', b.store_product_id,
              'saleStoreProductId', case
                when b.sale_store_product_id is not null
                  and (b.sale_from is null or b.sale_from <= p.at)
                  and (b.sale_until is null or b.sale_until > p.at)
                then b.sale_store_product_id
                else null
              end,
              'owned', (
                b.store_product_id is null
                or exists (
                  select 1
                  from public.user_entitlements e
                  where e.user_id = auth.uid()
                    and e.pack_id = b.id
                    and e.revoked_at is null
                )
              ),
              'cardArt', (
                select coalesce(
                  jsonb_agg(
                    jsonb_build_object(
                      'artId', ba.art_id,
                      'packId', ba.pack_id,
                      'kind', ba.kind,
                      'label', ba.label,
                      'path', ba.path
                    )
                  ),
                  '[]'::jsonb
                )
                from (
                  select *
                  from public.pack_art
                  where pack_id = b.id and status = 'live'
                  order by (kind = 'magnet') desc, sort, art_id
                  limit 1
                ) ba
              )
            ) order by b.sort, b.id
          ),
          '[]'::jsonb
        )
        from public.pack_catalog b
        where b.id = any(coalesce(pc.bundle_of, '{}'::text[]))
      )
      else '[]'::jsonb
    end as bundle_items
  ) bi
),
hidden_for_update as (
  select count(*)::integer as n
  from public.pack_catalog pc, params p
  where pc.kind <> 'bundle'
    and (pc.status = 'live' or (pc.status = 'draft' and p.tester))
    and (pc.available_from is null or pc.available_from <= p.at)
    and (pc.available_until is null or pc.available_until > p.at)
    and (pc.regions is null or (p.region is not null and p.region = any(pc.regions)))
    and pc.min_renderer > p.renderer
    and exists (select 1 from category_base c where c.id = pc.category_id)
)
select jsonb_build_object(
  'categories', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'chipLabel', c.chip_label,
          'cardTag', c.card_tag,
          'layout', c.layout
        ) order by c.sort, c.id
      )
      from visible_categories c
    ),
    '[]'::jsonb
  ),
  'packs', coalesce(
    (
      select jsonb_agg(pj.obj order by pj.cat_sort, pj.sort, pj.id)
      from pack_json pj
    ),
    '[]'::jsonb
  ),
  'hiddenForUpdate', (select n from hidden_for_update)
);
$$;

revoke all on function public.get_shop(integer, text) from public, anon;
grant execute on function public.get_shop(integer, text) to authenticated;
