import type { ShopPack } from '../../types';
import type { StorePrice } from '../../lib/purchases';
import { salePercent } from '../../lib/shop';

export type PackPricing = {
  loading: boolean;
  missing: boolean;
  current: StorePrice | null;
  normal: StorePrice | null;
  sale: StorePrice | null;
  salePercent: number | null;
  /** Button text while loading works from priceLabel; afterwards store copy. */
  label: string;
  /** Normal price to show with a line through it during a sale. */
  normalLabel: string | null;
};

type PricePack = Pick<ShopPack, 'storeProductId' | 'saleStoreProductId' | 'priceLabel'>;

/** Resolve one pack's store price. Free packs have no store product. */
export function pricingFor(
  pack: PricePack,
  prices: Map<string, StorePrice>,
  pricesLoading: boolean,
): PackPricing {
  const normal = pack.storeProductId ? prices.get(pack.storeProductId) : undefined;
  if (!pack.storeProductId) {
    return {
      loading: false,
      missing: false,
      current: null,
      normal: null,
      sale: null,
      salePercent: null,
      label: 'Free',
      normalLabel: null,
    };
  }

  const salePrice = pack.saleStoreProductId ? prices.get(pack.saleStoreProductId) : undefined;
  const percent = salePercent(normal, salePrice);
  const current = percent !== null && salePrice ? salePrice : normal;
  const loading = pricesLoading && !normal;

  // Local catalogue previews (no RevenueCat key) still need to show paid packs.
  // Production keeps the strict "hide when the store has no price" rule.
  if (__DEV__ && !pricesLoading && !normal) {
    return {
      loading: false,
      missing: false,
      current: null,
      normal: null,
      sale: null,
      salePercent: null,
      label: pack.priceLabel ?? 'Unavailable',
      normalLabel: null,
    };
  }

  return {
    loading,
    missing: !pricesLoading && !normal,
    current: current ?? null,
    normal: normal ?? null,
    sale: percent !== null ? (salePrice ?? null) : null,
    salePercent: percent,
    label: current?.priceString ?? pack.priceLabel ?? '…',
    normalLabel: percent !== null && normal ? normal.priceString : null,
  };
}

/** A paid pack with no store price is hidden once prices have loaded. */
export function pricingVisible(pricing: PackPricing): boolean {
  return pricing.loading || !pricing.missing;
}
