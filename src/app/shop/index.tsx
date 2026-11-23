import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { colors, fonts } from '../../theme';
import { useSession } from '../../store/session';
import { useToast } from '../../store/toast';
import { useMyBoards } from '../../hooks/useBoards';
import { recallBoard } from '../../lib/lastBoard';
import { boardCanUse, friendlyMessage, getShop } from '../../lib/api';
import {
  configureStore,
  getStorePrices,
  isStoreConfigured,
  purchaseProduct,
  restorePurchases,
  type StorePrice,
} from '../../lib/purchases';
import {
  SHOP_RENDERER,
  bundleSavingPercent,
  deviceRegion,
  isFreePack,
  readShopCache,
  writeShopCache,
} from '../../lib/shop';
import { CollectionOffer } from '../../components/shop/CollectionOffer';
import { FilterChips, type ShopFilter } from '../../components/shop/FilterChips';
import { ShopPackCard, type ShopCardState } from '../../components/shop/ShopPackCard';
import { pricingFor, pricingVisible, type PackPricing } from '../../components/shop/pricing';
import type { Board, ShopCardArt, ShopData, ShopPack } from '../../types';

function storeError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === 'store_unavailable') return "Purchases aren't available in this build.";
    if (e.message === 'product_unavailable') return "This pack isn't in the store yet.";
  }
  return friendlyMessage(e);
}

const EMPTY_PRICES = new Map<string, StorePrice>();

export default function ShopScreen() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const showToast = useToast((s) => s.show);
  const { boards } = useMyBoards();
  const params = useLocalSearchParams<{ boardId?: string }>();
  const region = useMemo(() => deviceRegion(), []);
  const { width, fontScale } = useWindowDimensions();
  const storeConfigured = isStoreConfigured();

  const [data, setData] = useState<ShopData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [priceResult, setPriceResult] = useState<{ key: string; map: Map<string, StorePrice> }>({
    key: '',
    map: EMPTY_PRICES,
  });
  const [ownership, setOwnership] = useState<{
    forData: ShopData | null;
    map: Record<string, boolean>;
  }>({ forData: null, map: {} });
  const [filter, setFilter] = useState('all');
  const [busyPack, setBusyPack] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [rememberedBoardId, setRememberedBoardId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      return () => setStatusBarStyle('light');
    }, []),
  );

  // Pick the board that owns the "Use / In use" state. A board passed by the
  // tray wins; otherwise remember the last opened fridge.
  useEffect(() => {
    let alive = true;
    void recallBoard().then((id) => {
      if (alive) setRememberedBoardId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const effectiveBoardId = useMemo(() => {
    if (params.boardId && boards.some((b) => b.id === params.boardId)) return params.boardId;
    if (rememberedBoardId && boards.some((b) => b.id === rememberedBoardId)) {
      return rememberedBoardId;
    }
    return boards[0]?.id ?? null;
  }, [params.boardId, boards, rememberedBoardId]);

  const selectedBoard: Board | null = boards.find((b) => b.id === effectiveBoardId) ?? null;

  useEffect(() => {
    if (user?.id) void configureStore(user.id);
  }, [user?.id]);

  // Cache first, then refresh (PRD §9.1).
  useEffect(() => {
    if (status !== 'ready' || !user?.id) return;
    let alive = true;
    void (async () => {
      const cached = await readShopCache(user.id, region);
      if (!alive) return;
      if (cached) {
        setData(cached);
        setLoading(false);
      }
      try {
        const fresh = await getShop(SHOP_RENDERER, region);
        if (!alive) return;
        setData(fresh);
        setError(null);
        setOffline(false);
        void writeShopCache(user.id, region, fresh);
      } catch (e) {
        if (!alive) return;
        if (cached) {
          setOffline(true);
          setError(null);
        } else {
          setError(friendlyMessage(e));
        }
      } finally {
        if (alive) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [status, user?.id, region, reloadKey]);

  const productIds = useMemo(() => {
    const ids = new Set<string>();
    if (!data) return [];
    for (const pack of data.packs) {
      if (pack.storeProductId) ids.add(pack.storeProductId);
      if (pack.saleStoreProductId) ids.add(pack.saleStoreProductId);
      for (const item of pack.bundleItems) {
        if (item.storeProductId) ids.add(item.storeProductId);
        if (item.saleStoreProductId) ids.add(item.saleStoreProductId);
      }
    }
    return [...ids].sort();
  }, [data]);

  const productKey = useMemo(() => productIds.join('|'), [productIds]);
  const pricesLoading =
    storeConfigured && productIds.length > 0 && priceResult.key !== productKey;
  const prices = priceResult.key === productKey ? priceResult.map : EMPTY_PRICES;

  useEffect(() => {
    if (!storeConfigured || productIds.length === 0) return;
    let alive = true;
    void getStorePrices(productIds).then((map) => {
      if (alive) setPriceResult({ key: productKey, map });
    });
    return () => {
      alive = false;
    };
  }, [productIds, productKey, storeConfigured]);

  // Ownership starts with the server's free + entitlement flags (including
  // hidden owned packs). Purchases/restores refresh it through boardCanUse.
  const serverOwned = useMemo(() => {
    const next: Record<string, boolean> = {};
    if (!data) return next;
    for (const pack of data.packs) {
      next[pack.id] = pack.owned;
      for (const item of pack.bundleItems) {
        next[item.id] = next[item.id] || item.owned;
      }
    }
    return next;
  }, [data]);

  const owned = ownership.forData === data ? ownership.map : serverOwned;

  const refreshOwnership = useCallback(async () => {
    if (!data) return;
    const ids = new Set<string>();
    for (const pack of data.packs) {
      ids.add(pack.id);
      for (const item of pack.bundleItems) ids.add(item.id);
    }
    const next: Record<string, boolean> = {};
    if (selectedBoard) {
      await Promise.all(
        [...ids].map(async (id) => {
          next[id] = await boardCanUse(selectedBoard.id, id).catch(() => false);
        }),
      );
    }
    setOwnership((prev) => {
      const base = prev.forData === data ? prev.map : serverOwned;
      const merged = { ...base, ...next };
      // A fire-and-forget fallback to the server's own ownership flags, in
      // case a store call succeeded before the entitlement webhook landed.
      for (const pack of data.packs) {
        if (pack.owned || pack.hidden) merged[pack.id] = true;
        for (const item of pack.bundleItems) {
          if (item.owned) merged[item.id] = true;
        }
      }
      return { forData: data, map: merged };
    });
  }, [data, selectedBoard, serverOwned]);

  const visiblePacks = useMemo(() => {
    if (!data) return [] as ShopPack[];
    return data.packs.filter((pack) => {
      if (pack.kind === 'bundle' || pack.hidden) return false;
      return pricingVisible(pricingFor(pack, prices, pricesLoading));
    });
  }, [data, prices, pricesLoading]);

  const sections = useMemo(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        category,
        packs: visiblePacks.filter((pack) => pack.categoryId === category.id),
      }))
      .filter((section) => section.packs.length > 0);
  }, [data, visiblePacks]);

  const filters = useMemo<ShopFilter[]>(() => {
    const chips: ShopFilter[] = [{ id: 'all', label: 'All' }];
    for (const section of sections) {
      if (section.category.chipLabel) {
        chips.push({ id: section.category.id, label: section.category.chipLabel });
      }
    }
    chips.push({ id: 'owned', label: 'Owned' });
    return chips;
  }, [sections]);

  const activeFilter = filters.some((f) => f.id === filter) ? filter : 'all';

  const ownedPacks = useMemo(() => {
    if (!data) return [] as ShopPack[];
    return data.packs.filter(
      (pack) => pack.kind !== 'bundle' && (owned[pack.id] || isFreePack(pack)),
    );
  }, [data, owned]);

  const featured = useMemo(
    () => data?.packs.find((pack) => pack.kind === 'bundle' && pack.featured && !pack.hidden) ?? null,
    [data],
  );
  const bundlePricing = featured ? pricingFor(featured, prices, pricesLoading) : null;
  const bundleVisible =
    Boolean(featured && bundlePricing) &&
    Boolean(bundlePricing && (bundlePricing.loading || !bundlePricing.missing));

  const bundleItems = useMemo(() => featured?.bundleItems ?? [], [featured]);
  const ownedEvery =
    bundleItems.length > 0
      ? bundleItems.every((item) => owned[item.id] || item.owned || !item.storeProductId)
      : Boolean(featured?.bundleOf?.length && featured.bundleOf.every((id) => owned[id]));

  const bundleArtTiles = useMemo(() => {
    const fromItems = bundleItems
      .map((item) => item.cardArt[0])
      .filter((art): art is ShopCardArt => Boolean(art));
    if (fromItems.length > 0) return fromItems.slice(0, 4);
    return (featured?.bundleOf ?? [])
      .map((id) => data?.packs.find((pack) => pack.id === id)?.cardArt[0])
      .filter((art): art is ShopCardArt => Boolean(art))
      .slice(0, 4);
  }, [bundleItems, featured, data]);
  const bundleExtra = Math.max(0, bundleItems.length - bundleArtTiles.length);

  const savingPercent = useMemo(() => {
    if (!bundlePricing?.normal) return null;
    const notOwned = bundleItems.filter(
      (item) => !(owned[item.id] || item.owned || !item.storeProductId),
    );
    if (notOwned.length === 0) return null;
    return bundleSavingPercent(
      bundlePricing.current ?? bundlePricing.normal ?? undefined,
      notOwned.map((item) => {
        return item.storeProductId ? prices.get(item.storeProductId) : undefined;
      }),
    );
  }, [bundlePricing, bundleItems, owned, prices]);

  const columns = fontScale >= 1.4 ? 1 : 2;
  const gridWidth = width - 40;
  const cardWidth = columns === 1 ? gridWidth : (gridWidth - 12) / 2;
  const rowCardWidth = Math.min(180, gridWidth * 0.46);

  const openPack = (pack: ShopPack) =>
    router.push(
      selectedBoard
        ? `/shop/${pack.id}?boardId=${selectedBoard.id}`
        : `/shop/${pack.id}`,
    );

  const buyPack = async (pack: ShopPack, pricing: PackPricing) => {
    if (!storeConfigured) {
      showToast("Purchases aren't available in this build.");
      return;
    }
    if (offline) return;
    const productId =
      pricing.sale && pack.saleStoreProductId
        ? pack.saleStoreProductId
        : pack.storeProductId;
    if (!productId) return;
    setBusyPack(pack.id);
    try {
      const result = await purchaseProduct(productId);
      if (result === 'cancelled') return;
      showToast(`${pack.name} is yours`);
      await refreshOwnership();
    } catch (e) {
      showToast(storeError(e));
    } finally {
      setBusyPack(null);
    }
  };

  const buyBundle = async () => {
    if (!featured || !bundlePricing) return;
    if (!storeConfigured) {
      showToast("Purchases aren't available in this build.");
      return;
    }
    if (offline) return;
    const productId =
      bundlePricing.sale && featured.saleStoreProductId
        ? featured.saleStoreProductId
        : featured.storeProductId;
    if (!productId) return;
    setBusyPack(featured.id);
    try {
      const result = await purchaseProduct(productId);
      if (result === 'cancelled') return;
      showToast(`${featured.name} is yours`);
      await refreshOwnership();
    } catch (e) {
      showToast(storeError(e));
    } finally {
      setBusyPack(null);
    }
  };

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      if (!storeConfigured) throw new Error('store_unavailable');
      await restorePurchases();
      await refreshOwnership();
      showToast('Purchases restored');
    } catch (e) {
      showToast(storeError(e));
    } finally {
      setRestoring(false);
    }
  };

  const stateFor = (pack: ShopPack): ShopCardState => {
    if (selectedBoard?.themePack === pack.id) return 'in-use';
    if (owned[pack.id] || isFreePack(pack)) return 'owned';
    const pricing = pricingFor(pack, prices, pricesLoading);
    if (pack.saleStoreProductId && pricing.sale && pricing.normal) return 'sale';
    return 'locked';
  };

  const activePacks =
    activeFilter === 'owned'
      ? ownedPacks
      : activeFilter === 'all'
        ? visiblePacks
        : sections.find((section) => section.category.id === activeFilter)?.packs ?? [];

  const renderCard = (pack: ShopPack, widthForCard: number) => {
    const state = stateFor(pack);
    const pricing = pricingFor(pack, prices, pricesLoading);
    return (
      <ShopPackCard
        key={pack.id}
        pack={pack}
        state={state}
        pricing={pricing}
        disabled={offline}
        buying={busyPack === pack.id}
        width={widthForCard}
        onOpen={() => openPack(pack)}
        onAction={() => {
          if (state === 'owned' || state === 'in-use') openPack(pack);
          else void buyPack(pack, pricing);
        }}
      />
    );
  };

  const renderSection = (title: string, packs: ShopPack[], layout: 'grid' | 'row') => (
    <View key={title} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {layout === 'row' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={rowCardWidth + 12}
          snapToAlignment="start"
          contentContainerStyle={styles.rowContent}
        >
          {packs.map((pack) => renderCard(pack, rowCardWidth))}
        </ScrollView>
      ) : (
        <View style={styles.grid}>{packs.map((pack) => renderCard(pack, cardWidth))}</View>
      )}
    </View>
  );

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.headerBtn}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>Shop</Text>
      <Pressable
        onPress={() => void restore()}
        disabled={restoring}
        hitSlop={8}
        style={styles.restore}
        accessibilityRole="button"
        accessibilityLabel="Restore purchases"
        accessibilityState={{ disabled: restoring }}
      >
        {restoring ? (
          <ActivityIndicator size="small" color={colors.accentDeep} />
        ) : (
          <Text style={styles.restoreText}>Restore</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header}
      {offline && data ? (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>You’re offline.</Text>
        </View>
      ) : null}

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn’t load the shop. Check your connection.</Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              setError(null);
              setReloadKey((key) => key + 1);
            }}
            style={styles.retry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                setReloadKey((key) => key + 1);
              }}
              tintColor={colors.ink}
            />
          }
        >
          {activeFilter === 'all' && bundleVisible && featured && bundlePricing ? (
            <View style={styles.pad}>
              <CollectionOffer
                bundle={featured}
                pricing={bundlePricing}
                artTiles={bundleArtTiles}
                extraCount={bundleExtra}
                savingPercent={savingPercent}
                ownedEvery={ownedEvery}
                disabled={offline}
                buying={busyPack === featured.id}
                onBuy={() => void buyBundle()}
              />
            </View>
          ) : null}

          <FilterChips filters={filters} selected={activeFilter} onSelect={setFilter} />

          <View style={styles.pad}>
            {activeFilter === 'owned' ? (
              activePacks.length > 0 ? (
                renderSection('Your packs', activePacks, 'grid')
              ) : (
                <Text style={styles.empty}>Nothing here yet.</Text>
              )
            ) : activePacks.length === 0 || sections.length === 0 ? (
              <Text style={styles.empty}>Nothing here yet.</Text>
            ) : activeFilter === 'all' ? (
              sections.map((section) =>
                renderSection(
                  section.category.title,
                  section.packs,
                  section.category.layout,
                ),
              )
            ) : (
              sections
                .filter((section) => section.category.id === filter)
                .map((section) =>
                  renderSection(
                    section.category.title,
                    section.packs,
                    section.category.layout,
                  ),
                )
            )}

            {data && data.hiddenForUpdate > 0 ? (
              <Text style={styles.updateLine}>
                Update the app to see {data.hiddenForUpdate} new pack
                {data.hiddenForUpdate === 1 ? '' : 's'}
              </Text>
            ) : null}

            <Text style={styles.footer}>
              One-time purchases. Shared with everyone on the board and with Family Sharing.
              All art is original to Fridge Board.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backGlyph: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.ink,
    marginTop: -2,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.extraBold,
    fontSize: 20,
    color: colors.ink,
  },
  restore: {
    minWidth: 48,
    height: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  restoreText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 16,
    color: colors.accentDeep,
  },
  offline: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 6,
  },
  offlineText: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.onPine },
  content: { paddingBottom: 28 },
  pad: { paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  errorTitle: {
    fontFamily: fonts.ui.bold,
    fontSize: 17,
    lineHeight: 23,
    color: colors.ink,
    textAlign: 'center',
  },
  retry: {
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandYellow,
  },
  retryText: { fontFamily: fonts.ui.extraBold, fontSize: 16, color: colors.ink },
  section: { marginTop: 20 },
  sectionTitle: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 21,
    lineHeight: 26,
    color: colors.ink,
    marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowContent: { gap: 12, paddingRight: 20 },
  empty: {
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.inkSoft,
    paddingVertical: 36,
    textAlign: 'center',
  },
  updateLine: {
    marginTop: 24,
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  footer: {
    marginTop: 18,
    fontFamily: fonts.ui.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
