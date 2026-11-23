-- Pack detail (docs/SHOP.md mockups): one pack, its full contents and spec.
--
-- ADD-ONLY migration (freeze in effect). Visibility/ownership reuse
-- get_shop(), so a pack that is visible in the shop — or is hidden but owned —
-- can be opened, while a hidden/retired pack the caller does not own returns
-- null.

create function public.get_pack_detail(
  p_pack_id text,
  p_renderer integer,
  p_region text
)
returns jsonb
language sql
stable
security definer
set search_path = '' as $$
with shop as (
  select public.get_shop(coalesce(p_renderer, 1), p_region) as data
),
matched as (
  select p.value as pack
  from shop, jsonb_array_elements(shop.data -> 'packs') as p
  where p.value ->> 'id' = p_pack_id
)
select (
  select jsonb_build_object(
    'pack', m.pack || jsonb_build_object('spec', pc.spec),
    'art', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'artId', a.art_id,
            'packId', a.pack_id,
            'kind', a.kind,
            'label', a.label,
            'path', a.path,
            'w', a.w,
            'h', a.h,
            'sort', a.sort
          ) order by a.sort, a.art_id
        )
        from public.pack_art a
        where a.pack_id = pc.id
          and (
            a.status = 'live'
            or (a.status = 'draft' and public.is_shop_tester())
          )
      ),
      '[]'::jsonb
    )
  )
  from matched m
  join public.pack_catalog pc on pc.id = p_pack_id
);
$$;

revoke all on function public.get_pack_detail(text, integer, text) from public, anon;
grant execute on function public.get_pack_detail(text, integer, text) to authenticated;
