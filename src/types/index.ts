export type MemberRole = 'owner' | 'member';
export type ItemType = 'note' | 'list' | 'date' | 'photo';
export type ItemColor =
  | 'butter'
  | 'blush'
  | 'sage'
  | 'sky'
  | 'lavender'
  | 'peach'
  | 'paper';
export type BoardColor =
  | 'sage'
  | 'blue'
  | 'clay'
  | 'cream'
  | 'charcoal'
  | 'mint'
  | 'butter'
  | 'blush'
  | 'powder'
  | 'vintage_mint'
  | 'vintage_butter'
  | 'vintage_blush'
  | 'vintage_powder';

export type User = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  createdAt: string;
  /** True for an anonymous (not-yet-linked) account. */
  isAnonymous?: boolean;
};

export type Board = {
  id: string;
  name: string;
  color: BoardColor;
  timezone: string;
  /** Door theme pack id; owner-set (H-1). Defaults to 'starter'. */
  themePack: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type BoardMember = {
  boardId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
  user: User;
};

/** A post. `type` is what the author chose — never re-guessed from the text. */
/** Hand-placed board spot. x is a fraction of board width, y is ref points. */
export type ItemLayout = {
  x: number;
  y: number;
  manual: boolean;
};

export type Item = {
  id: string;
  boardId: string;
  type: ItemType;
  color: ItemColor;
  /** Composer paper pick as '<pack_id>:<paper_id>'; null = plain colour. */
  paperStyle: string | null;
  /** Note text or photo caption. */
  body: string | null;
  /** List or date title. */
  title: string | null;
  eventAt: string | null;
  place: string | null;
  photoPath: string | null;
  /** Share-extension attribution ("Shared from WhatsApp · Paul"), or null. */
  sharedFromApp: string | null;
  sharedFromAuthor: string | null;
  /** Manual position, or null for the automatic layout. */
  layout: ItemLayout | null;
  pinned: boolean;
  keepUntil: string | null;
  doneAt: string | null;
  doneBy: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ItemWithAuthor = Item & { author: User | null };

/** One selectable paper in the composer, resolved from live pack specs.
 *  `key` is the stored `<packId>:<paperId>` value. */
export type PaperOption = {
  key: string;
  packId: string;
  packName: string;
  paperId: string;
  name: string;
  bg: string;
  ink: string;
  texture?: string;
  header?: string;
  /** False when this board cannot use the pack (kept for rendering old notes). */
  available: boolean;
};

export type ListEntry = {
  id: string;
  itemId: string;
  boardId: string;
  text: string;
  position: number;
  checkedAt: string | null;
  checkedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PackKind = 'theme' | 'travel' | 'festival' | 'bundle' | 'gift';
export type PackArtKind = 'magnet' | 'sticker' | 'paper' | 'fastener' | 'door';
export type PackArtStatus = 'draft' | 'live' | 'retired';
export type PackArtType =
  | 'object'
  | 'word'
  | 'badge'
  | 'place'
  | 'team'
  | 'letter'
  | 'photo'
  | 'holder'
  | 'live';

/** The data-driven pack renderer spec (PRD §9.1). Fields are optional so the
 *  app can render a pack before every admin field exists. */
export type PackSpecDoor = {
  light?: string;
  base?: string;
  shade?: string;
  handle?: string;
  titleInk?: string;
  name?: string;
};

export type PackSpecPaper = {
  id?: string;
  name?: string;
  bg?: string;
  ink?: string;
  texture?: string;
  header?: string;
  fastener?: string;
};

/** Optional sample layout for the shop preview (PRD §9.1). */
export type PackSpecPreview = {
  /** Paper index per sample card, in order: note, list, date, photo. */
  papers?: number[];
};

export type PackSpec = {
  door?: PackSpecDoor;
  papers?: PackSpecPaper[];
  magnets?: string[];
  stickers?: string[];
  holder?: string;
  preview?: PackSpecPreview;
  [key: string]: unknown;
};

/** A decoration placed on the fridge door (docs/prd-magents-stickers.md §5). */
export type Magnet = {
  id: string;
  boardId: string;
  artId: string;
  packId: string;
  /** Attached note; null = anchored to the door. */
  itemId: string | null;
  /** Door: fraction of width; attached: fraction of note width. */
  x: number;
  /** Door: ref points; attached: ref points from the note's top. */
  y: number;
  rotation: number;
  z: number;
  placedBy: string | null;
  giftNote: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** A flat die-cut reaction artwork is part of the pack catalogue as data, but
 *  reactions themselves are not part of the board UI. */

/** One piece of pack artwork (magnets, stickers, papers, fasteners, doors). */
export type PackArt = {
  artId: string;
  packId: string;
  kind: PackArtKind;
  label: string;
  path: string;
  w: number | null;
  h: number | null;
  status?: PackArtStatus;
  sort?: number;
  type?: PackArtType;
};

export type Pack = {
  id: string;
  kind: PackKind;
  name: string;
  blurb: string | null;
  priceLabel: string | null;
  status: 'draft' | 'live' | 'retired';
};

/** Shop page catalogue (docs/SHOP.md). Data-only: no pack-specific UI code. */
export type ShopCategoryLayout = 'grid' | 'row';

export type ShopCategory = {
  id: string;
  title: string;
  chipLabel: string | null;
  cardTag: string | null;
  layout: ShopCategoryLayout;
};

export type ShopCardArt = {
  artId: string;
  packId: string;
  kind: PackArtKind;
  label: string;
  path: string;
};

/** One pack inside the featured bundle, used to price the collection offer. */
export type ShopBundleItem = {
  id: string;
  name: string;
  kind: PackKind;
  storeProductId: string | null;
  saleStoreProductId: string | null;
  cardArt: ShopCardArt[];
  owned: boolean;
};

export type ShopPack = {
  id: string;
  categoryId: string | null;
  kind: PackKind;
  name: string;
  blurb: string | null;
  storeProductId: string | null;
  saleStoreProductId: string | null;
  saleUntil: string | null;
  saleLabel: string | null;
  priceLabel: string | null;
  availableUntil: string | null;
  badgeText: string | null;
  cardArt: ShopCardArt[];
  cardBg: string | null;
  cardTag: string | null;
  itemCount: number;
  bundleOf: string[] | null;
  bundleItems: ShopBundleItem[];
  featured: boolean;
  /** True only for an owned pack that today's shop filters would hide. */
  hidden: boolean;
  owned: boolean;
};

export type ShopData = {
  categories: ShopCategory[];
  packs: ShopPack[];
  hiddenForUpdate: number;
};

/** The detail screen gets the same shop pack plus the renderer spec and every
 *  live art row (preview + contents). */
export type PackDetailPack = ShopPack & { spec: PackSpec };

export type PackDetail = {
  pack: PackDetailPack;
  art: PackArt[];
};

export type InviteLink = {
  token: string;
  code: string;
  expiresAt: string;
};

export type InvitePreview = {
  boardName: string;
  invitedBy: string | null;
  memberFirstNames: string[];
  memberCount: number;
};
