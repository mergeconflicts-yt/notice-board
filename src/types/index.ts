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
export type BoardColor = 'sage' | 'blue' | 'clay' | 'cream' | 'charcoal';

export type User = {
  id: string;
  displayName: string;
  avatarPath: string | null;
  createdAt: string;
};

export type Board = {
  id: string;
  name: string;
  color: BoardColor;
  timezone: string;
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
  /** Note text or photo caption. */
  body: string | null;
  /** List or date title. */
  title: string | null;
  eventAt: string | null;
  place: string | null;
  photoPath: string | null;
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

export type UserSettings = {
  lastBoardId: string | null;
  locale: string | null;
  timezone: string | null;
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
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
