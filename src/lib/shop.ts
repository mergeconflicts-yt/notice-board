import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import type { ShopData, ShopPack } from '../types';
import type { StorePrice } from './purchases';

/** Highest pack-renderer version this build understands (PRD §9.1).
 *  2 adds the gingham, heart-dot and diary paper textures plus the pink
 *  round-magnet holder used by the Cute pack. */
export const SHOP_RENDERER = 2;

/** ISO country code for the current device, or null when unavailable. */
export function deviceRegion(): string | null {
  try {
    const region = getLocales()[0]?.regionCode;
    return region ? region.toUpperCase() : null;
  } catch {
    return null;
  }
}

/** A pack with no store product is free (Starter is the launch example). */
export function isFreePack(pack: ShopPack): boolean {
  return !pack.storeProductId && pack.kind !== 'bundle';
}

const CACHE_PREFIX = 'notice.shop.v1';

function cacheKey(userId: string | null, region: string | null): string {
  return `${CACHE_PREFIX}:${userId ?? 'anon'}:${region ?? 'all'}:${SHOP_RENDERER}`;
}

/** Last shop payload, shown immediately on the next open before refreshing. */
export async function readShopCache(
  userId: string | null,
  region: string | null,
): Promise<ShopData | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId, region));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopData;
    if (!Array.isArray(parsed?.categories) || !Array.isArray(parsed?.packs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeShopCache(
  userId: string | null,
  region: string | null,
  data: ShopData,
): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(userId, region), JSON.stringify(data));
  } catch {
    // Best effort — the catalogue refreshes on the next open anyway.
  }
}

/** Percent off, rounded down, from the two store prices. */
export function salePercent(
  normal: StorePrice | undefined,
  sale: StorePrice | undefined,
): number | null {
  if (!normal || !sale || normal.price <= 0 || sale.price >= normal.price) return null;
  return Math.floor((1 - sale.price / normal.price) * 100);
}

/** Bundle saving, rounded down; null until every non-owned item is priced. */
export function bundleSavingPercent(
  bundle: StorePrice | undefined,
  itemPrices: (StorePrice | undefined)[],
): number | null {
  if (!bundle || bundle.price <= 0) return null;
  let sum = 0;
  for (const price of itemPrices) {
    if (!price) return null;
    sum += price.price;
  }
  if (sum <= 0 || bundle.price >= sum) return null;
  return Math.floor((1 - bundle.price / sum) * 100);
}

/** "Until 26 Dec" when the end date is within 60 days, else null. */
export function endDateBadge(availableUntil: string | null): string | null {
  if (!availableUntil) return null;
  const end = new Date(availableUntil);
  if (Number.isNaN(end.getTime())) return null;
  const days = (end.getTime() - Date.now()) / 86_400_000;
  if (days < 0 || days > 60) return null;
  const date = end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `Until ${date}`;
}
