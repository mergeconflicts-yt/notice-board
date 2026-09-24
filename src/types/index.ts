export type User = {
  id: string;
  displayName: string;
  avatar: string | null;
  createdAt: string;
};

export type Board = {
  id: string;
  name: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
};

export type BoardMember = {
  boardId: string;
  userId: string;
  joinedAt: string;
};

export type MemberWithUser = BoardMember & { user: User };

export type NoteColor = 'yellow' | 'green' | 'pink' | 'blue' | 'lavender';

export type NoteKind = 'note' | 'photo' | 'list' | 'appointment';

export type Note = {
  id: string;
  boardId: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  color: NoteColor;
  rotation: number;
  positionX: number;
  positionY: number;
  kind: NoteKind;
  data: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  completedAt: string | null;
};

export type NoteWithAuthor = Note & { author: User | null };

export type NewNote = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;

export type NotePatch = Partial<
  Pick<Note, 'text' | 'imageUrl' | 'color' | 'rotation' | 'positionX' | 'positionY' | 'expiresAt' | 'completedAt' | 'kind' | 'data'>
>;

// ---------------------------------------------------------------------------
// Backend v2: board_items / list_entries / item_assets / invites / events.
// ---------------------------------------------------------------------------

export type BoardRole = 'owner' | 'admin' | 'member';

export type BoardItemType = 'note' | 'photo' | 'list' | 'date';

/** Visual paper: colour + tilt. Stored in board_items.paper. */
export type ItemPaper = {
  color: NoteColor;
  rotation: number;
};

/** Hand-placed spot. Null means the automatic layout decides. */
export type ItemLayout = {
  x: number;
  y: number;
  manual: boolean;
} | null;

export type BoardItem = {
  id: string;
  boardId: string;
  type: BoardItemType;
  body: string | null;
  eventAt: string | null;
  expiresAt: string | null;
  paper: ItemPaper;
  layout: ItemLayout;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
  completedBy: string | null;
  completedAt: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  version: number;
};

export type BoardItemWithAuthor = BoardItem & { author: User | null };

export type NewBoardItem = {
  boardId: string;
  type: BoardItemType;
  body?: string | null;
  eventAt?: string | null;
  expiresAt?: string | null;
  paper?: Partial<ItemPaper> | null;
  layout?: ItemLayout;
};

/**
 * Never carries actor fields, timestamps, or version — the server stamps
 * those via triggers. Pass expectedVersion separately for a conflict check.
 */
export type BoardItemPatch = {
  body?: string | null;
  eventAt?: string | null;
  expiresAt?: string | null;
  paper?: Partial<ItemPaper> | null;
  layout?: ItemLayout;
  completedAt?: string | null;
  deletedAt?: string | null;
};

export type ListEntry = {
  id: string;
  boardId: string;
  itemId: string;
  text: string;
  position: number;
  isChecked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  version: number;
};

export type NewListEntry = {
  boardId: string;
  itemId: string;
  text: string;
  position?: number;
};

export type ListEntryPatch = {
  text?: string;
  position?: number;
  isChecked?: boolean;
  deletedAt?: string | null;
};

export type ItemAsset = {
  id: string;
  boardId: string;
  itemId: string;
  storagePath: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type BoardInvite = {
  id: string;
  boardId: string;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  acceptedBy: string | null;
  acceptedAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
};

/** The raw token is returned once at creation and never stored. */
export type CreatedInvite = {
  invite: BoardInvite;
  token: string;
};

export type BoardEvent = {
  id: string;
  boardId: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
};

export type BoardMembership = {
  boardId: string;
  userId: string;
  role: BoardRole;
  joinedAt: string;
  invitedBy: string | null;
  removedBy: string | null;
  removedAt: string | null;
  leftAt: string | null;
  user: User;
};

export type BoardDetails = Board & {
  createdBy: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  version: number;
  settings: Record<string, unknown>;
};

export type UserSettings = {
  userId: string;
  lastBoardId: string | null;
  locale: string | null;
  timezone: string | null;
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
};

export type UserSettingsPatch = {
  lastBoardId?: string | null;
  locale?: string | null;
  timezone?: string | null;
  theme?: 'system' | 'light' | 'dark';
  reduceMotion?: boolean;
};
