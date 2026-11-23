import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';
import { useSession } from '../../store/session';
import { useToast } from '../../store/toast';
import { useMyBoards } from '../../hooks/useBoards';
import { recallBoard } from '../../lib/lastBoard';
import {
  friendlyMessage,
  getBoardContent,
  getMembers,
  getPackDetail,
  setBoardTheme,
} from '../../lib/api';
import {
  configureStore,
  getStorePrices,
  isStoreConfigured,
  purchaseProduct,
  type StorePrice,
} from '../../lib/purchases';
import { SHOP_RENDERER, deviceRegion, isFreePack } from '../../lib/shop';
import { cachedPhotoUri } from '../../lib/photoCache';
import { PackPreview } from '../../components/shop/PackPreview';
import { PackContents } from '../../components/shop/PackContents';
import { pricingFor } from '../../components/shop/pricing';
import type {
  BoardMember,
  ItemWithAuthor,
  ListEntry,
  PackDetail,
} from '../../types';

function storeError(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === 'store_unavailable') return "Purchases aren't available in this build.";
    if (e.message === 'product_unavailable') return "This pack isn't in the store yet.";
  }
  return friendlyMessage(e);
}

const EMPTY_PRICES = new Map<string, StorePrice>();

export default function PackDetailScreen() {
  const user = useSession((s) => s.user);
  const status = useSession((s) => s.status);
  const showToast = useToast((s) => s.show);
  const { boards } = useMyBoards();
  const params = useLocalSearchParams<{ packId: string; boardId?: string }>();
  const region = useMemo(() => deviceRegion(), []);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const storeConfigured = isStoreConfigured();

  const [detail, setDetail] = useState<PackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [items, setItems] = useState<ItemWithAuthor[]>([]);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const [priceResult, setPriceResult] = useState<{ key: string; map: Map<string, StorePrice> }>({
    key: '',
    map: EMPTY_PRICES,
  });
  const [buying, setBuying] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rememberedBoardId, setRememberedBoardId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('light');
    }, []),
  );

  useEffect(() => {
    let alive = true;
    void recallBoard().then((id) => {
      if (alive) setRememberedBoardId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  const board = useMemo(() => {
    if (params.boardId && boards.some((item) => item.id === params.boardId)) {
      return boards.find((item) => item.id === params.boardId) ?? null;
    }
    if (rememberedBoardId) {
      const remembered = boards.find((item) => item.id === rememberedBoardId);
      if (remembered) return remembered;
    }
    return boards[0] ?? null;
  }, [params.boardId, boards, rememberedBoardId]);

  useEffect(() => {
    if (user?.id) void configureStore(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (status !== 'ready' || !user?.id) return;
    let alive = true;
    void getPackDetail(params.packId, SHOP_RENDERER, region)
      .then((next) => {
        if (!alive) return;
        setDetail(next);
        setError(next ? null : 'This pack is no longer available.');
      })
      .catch((e) => {
        if (alive) setError(friendlyMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [status, user?.id, params.packId, region, reloadKey]);

  useEffect(() => {
    if (!board?.id) return;
    let alive = true;
    void Promise.all([getMembers(board.id), getBoardContent(board.id)])
      .then(async ([nextMembers, content]) => {
        if (!alive) return;
        setMembers(nextMembers);
        setItems(content.items);
        setEntries(content.entries);
        const photo = content.items.find(
          (item) => item.type === 'photo' && Boolean(item.photoPath),
        );
        if (photo?.photoPath) {
          const url = await cachedPhotoUri(photo.photoPath);
          if (alive && url) setPhotoUrl(url);
        }
      })
      .catch(() => {
        // The preview falls back to sample content when board content fails.
      });
    return () => {
      alive = false;
    };
  }, [board?.id]);

  const pack = detail?.pack ?? null;
  const art = detail?.art ?? [];

  useEffect(() => {
    setStatusBarStyle(pack ? 'light' : 'dark');
  }, [pack]);

  const productIds = useMemo(
    () =>
      [pack?.storeProductId, pack?.saleStoreProductId].filter(
        (id): id is string => Boolean(id),
      ),
    [pack?.storeProductId, pack?.saleStoreProductId],
  );
  const productKey = productIds.join('|');
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

  const pricing = pack ? pricingFor(pack, prices, pricesLoading) : null;
  const owned = pack?.owned === true;
  const free = pack ? isFreePack(pack) : false;
  const hasPack = owned || free;
  const themePack = themeOverride ?? board?.themePack ?? null;
  const inUse = Boolean(pack && themePack === pack.id);
  const isTheme = pack?.kind === 'theme';
  const isOwner = members.some(
    (member) => member.userId === user?.id && member.role === 'owner',
  );

  const previewHeight = Math.min(480, height * 0.55);

  const buy = async () => {
    if (!pack || !pricing) return;
    if (!storeConfigured) {
      showToast("Purchases aren't available in this build.");
      return;
    }
    const productId =
      pricing.sale && pack.saleStoreProductId
        ? pack.saleStoreProductId
        : pack.storeProductId;
    if (!productId) return;
    setBuying(true);
    try {
      const result = await purchaseProduct(productId);
      if (result === 'cancelled') return;
      showToast(`${pack.name} is yours`);
      setReloadKey((key) => key + 1);
    } catch (e) {
      showToast(storeError(e));
    } finally {
      setBuying(false);
    }
  };

  const applyTheme = async () => {
    if (!board || !pack) return;
    setApplying(true);
    try {
      await setBoardTheme(board.id, pack.id);
      setThemeOverride(pack.id);
      showToast('Door updated');
    } catch (e) {
      showToast(friendlyMessage(e));
    } finally {
      setApplying(false);
    }
  };

  const usePack = () => {
    if (board) router.push(`/board/${board.id}`);
    else router.back();
  };

  const subtext = !pack
    ? ''
    : inUse && free
      ? 'This is the free pack.'
      : inUse
        ? 'Shared with everyone on the board and with Family Sharing.'
        : hasPack && isTheme && !isOwner
          ? 'Only the fridge owner can change the door.'
          : hasPack
            ? 'Shared with everyone on the board and with Family Sharing.'
            : 'One-time purchase. Shared with everyone on the board and with Family Sharing.';

  const renderAction = () => {
    if (!pack || !pricing) return null;

    if (inUse) {
      return (
        <View style={[styles.actionBtn, styles.actionInUse]}>
          <MaterialCommunityIcons name="check" size={19} color={colors.pine} />
          <Text style={[styles.actionText, styles.actionTextInUse]}>In use on this fridge</Text>
        </View>
      );
    }

    if (hasPack && isTheme) {
      if (!board || !isOwner) {
        return (
          <View style={[styles.actionBtn, styles.actionOwned]}>
            <Text style={styles.actionText}>Owned</Text>
          </View>
        );
      }
      return (
        <Pressable
          onPress={() => void applyTheme()}
          disabled={applying}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionUse,
            applying && styles.actionDisabled,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Use ${pack.name} on this fridge`}
          accessibilityState={{ disabled: applying }}
        >
          {applying ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Text style={styles.actionText}>Use on this fridge</Text>
          )}
        </Pressable>
      );
    }

    if (hasPack) {
      return (
        <Pressable
          onPress={usePack}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionUse,
            pressed && styles.actionPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Use ${pack.name}`}
        >
          <Text style={styles.actionText}>Use</Text>
        </Pressable>
      );
    }

    if (pricing.loading) {
      return (
        <View style={[styles.actionBtn, styles.actionOutline]}>
          <ActivityIndicator size="small" color={colors.ink} />
        </View>
      );
    }

    if (pricing.missing) {
      return (
        <View style={[styles.actionBtn, styles.actionOwned]}>
          <Text style={styles.actionText}>Unavailable</Text>
        </View>
      );
    }

    return (
      <Pressable
        onPress={() => void buy()}
        disabled={buying}
        style={({ pressed }) => [
          styles.actionBtn,
          styles.actionBuy,
          buying && styles.actionDisabled,
          pressed && styles.actionPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Buy ${pack.name} for ${pricing.label}`}
        accessibilityState={{ disabled: buying }}
      >
        {buying ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <View style={styles.buyRow}>
            <Text style={styles.actionText}>Buy · {pricing.label}</Text>
            {pricing.normalLabel ? (
              <Text style={styles.strike}>{pricing.normalLabel}</Text>
            ) : null}
          </View>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SimpleHeader onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pack || !pricing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <SimpleHeader onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{error ?? 'This pack is no longer available.'}</Text>
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
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 148 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <PackPreview
          pack={pack}
          art={art}
          board={board}
          items={items}
          entries={entries}
          photoUrl={photoUrl}
          height={previewHeight}
          owned={hasPack}
          onBack={() => router.back()}
        />
        <PackContents
          pack={pack}
          art={art}
          board={board}
          members={members}
          owned={hasPack}
        />
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {renderAction()}
        {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

function SimpleHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.simpleHeader}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={styles.simpleBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Text style={styles.backGlyph}>‹</Text>
      </Pressable>
      <Text style={styles.simpleTitle}>Pack</Text>
      <View style={styles.simpleBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  simpleHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  simpleBack: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 30, lineHeight: 32, color: colors.ink, marginTop: -2 },
  simpleTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.ui.extraBold,
    fontSize: 20,
    color: colors.ink,
  },
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
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionBtn: {
    minHeight: 56,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  actionInUse: { backgroundColor: colors.leaf },
  actionUse: { backgroundColor: colors.brandYellow },
  actionBuy: { backgroundColor: colors.brandYellow },
  actionOutline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionOwned: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDisabled: { opacity: 0.55 },
  actionPressed: { opacity: 0.82 },
  actionText: {
    fontFamily: fonts.ui.extraBold,
    fontSize: 17,
    color: colors.ink,
  },
  actionTextInUse: { color: colors.pine },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strike: {
    fontFamily: fonts.ui.semibold,
    fontSize: 13,
    color: colors.inkSoft,
    textDecorationLine: 'line-through',
  },
  subtext: {
    marginTop: 8,
    fontFamily: fonts.ui.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.inkSoft,
    textAlign: 'center',
  },
});
