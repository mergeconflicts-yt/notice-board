import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  isPurchasesError,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

/**
 * RevenueCat is the only source of shop prices and the only way a purchase
 * starts (docs/SHOP.md §4–§5). The catalogue supplies store product ids; it
 * never supplies a price.
 *
 * The SDK needs a development build and a public key per platform. When no
 * key is configured the shop treats the store as unavailable: paid packs stay
 * hidden and the Restore button reports that purchases are unavailable.
 */

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';

export type StorePrice = {
  productId: string;
  /** Numeric price used for discounts and bundle savings. */
  price: number;
  /** Formatted price in the buyer's storefront, e.g. "$1.99". */
  priceString: string;
  currencyCode: string;
};

const apiKey = Platform.OS === 'ios' ? IOS_KEY : Platform.OS === 'android' ? ANDROID_KEY : '';

let configured = false;
let configuring: Promise<boolean> | null = null;
let identifiedUser: string | null = null;

/** Whether this build has a public RevenueCat key for the current platform. */
export function isStoreConfigured(): boolean {
  return Boolean(apiKey);
}

/**
 * Configure the SDK once and identify the signed-in app user. Safe to call
 * from every shop open; repeat calls reuse the configured instance.
 */
export async function configureStore(appUserId?: string | null): Promise<boolean> {
  if (!apiKey) return false;
  if (!configuring) {
    configuring = (async () => {
      if (configured) return true;
      try {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey });
        configured = true;
        return true;
      } catch (e) {
        if (__DEV__) console.warn('[purchases] configure failed', e);
        return false;
      }
    })();
  }
  const ready = await configuring;
  if (!ready) {
    configuring = null;
    return false;
  }

  if (appUserId && identifiedUser !== appUserId) {
    try {
      await Purchases.logIn(appUserId);
      identifiedUser = appUserId;
    } catch (e) {
      if (__DEV__) console.warn('[purchases] logIn failed', e);
    }
  }
  return true;
}

/** Store prices for the requested product ids, keyed by product id. */
export async function getStorePrices(productIds: string[]): Promise<Map<string, StorePrice>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const ready = configured || (await configureStore());
  if (!ready) return new Map();
  try {
    const products = await Purchases.getProducts(ids, PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    if (__DEV__) {
      const found = new Set(products.map((product) => product.identifier));
      const missing = ids.filter((id) => !found.has(id));
      if (missing.length > 0) {
        console.warn('[purchases] no store price for', missing.join(', '));
      }
    }
    return new Map(
      products.map((product: PurchasesStoreProduct) => [
        product.identifier,
        {
          productId: product.identifier,
          price: product.price,
          priceString: product.priceString,
          currencyCode: product.currencyCode,
        },
      ]),
    );
  } catch (e) {
    if (__DEV__) console.warn('[purchases] getProducts failed', e);
    return new Map();
  }
}

/** Start the native store purchase sheet. Throws for real failures. */
export async function purchaseProduct(productId: string): Promise<'purchased' | 'cancelled'> {
  const ready = configured || (await configureStore());
  if (!ready) throw new Error('store_unavailable');
  try {
    const products = await Purchases.getProducts([productId], PRODUCT_CATEGORY.NON_SUBSCRIPTION);
    const product = products.find((p) => p.identifier === productId);
    if (!product) throw new Error('product_unavailable');
    await Purchases.purchaseStoreProduct(product);
    return 'purchased';
  } catch (e) {
    if (
      (isPurchasesError(e) && e.userCancelled === true) ||
      (typeof e === 'object' && e !== null && (e as { userCancelled?: unknown }).userCancelled === true)
    ) {
      return 'cancelled';
    }
    throw e;
  }
}

/** Re-sync store purchases with RevenueCat. Throws for real failures. */
export async function restorePurchases(): Promise<void> {
  const ready = configured || (await configureStore());
  if (!ready) throw new Error('store_unavailable');
  await Purchases.restorePurchases();
}
