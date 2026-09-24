import {
  BoardDetails,
  BoardEvent,
  BoardInvite,
  BoardItem,
  BoardItemPatch,
  BoardItemWithAuthor,
  BoardMembership,
  CreatedInvite,
  ItemAsset,
  ListEntry,
  ListEntryPatch,
  NewBoardItem,
  NewListEntry,
  User,
  UserSettings,
  UserSettingsPatch,
} from '../types';
import { Unsubscribe } from './backend';

/** Thrown when an update loses an optimistic-concurrency check. */
export class VersionConflictError extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} changed while you were editing it`);
    this.name = 'VersionConflictError';
  }
}

/**
 * Backend v2, built on board_items / list_entries / item_assets plus
 * invites, audit events and settings.
 *
 * Write boundary: clients never send actor fields (created_by, updated_by,
 * …), timestamps, or versions on write — the database stamps them. The only
 * version the client ever sends is `expectedVersion`, purely as an
 * optimistic-concurrency guard.
 *
 * Currently Supabase-only; there is no local-mode implementation yet, so
 * `getBackendV2()` throws when Supabase is not configured. The v1 backend
 * stays live until the app is ported.
 */
export interface NoticeBackendV2 {
  readonly mode: 'supabase';

  ensureProfile(displayName: string, avatar?: string | null): Promise<User>;

  getBoard(id: string): Promise<BoardDetails | null>;
  getBoards(): Promise<BoardDetails[]>;
  onBoardChanged(boardId: string, cb: (board: BoardDetails | null) => void): Unsubscribe;
  onMembersChanged(boardId: string, cb: (members: BoardMembership[]) => void): Unsubscribe;
  createBoard(name: string): Promise<BoardDetails>;
  updateBoard(
    id: string,
    patch: { name?: string; settings?: Record<string, unknown> },
    expectedVersion?: number,
  ): Promise<void>;
  /** Soft delete — the row stays for restore/audit. */
  deleteBoard(id: string): Promise<void>;
  restoreBoard(id: string): Promise<void>;
  leaveBoard(id: string): Promise<void>;
  getMembers(boardId: string): Promise<BoardMembership[]>;

  createInvite(
    boardId: string,
    opts?: { maxUses?: number | null; expiresAt?: string | null },
  ): Promise<CreatedInvite>;
  /** Returns the joined board's id. */
  acceptInvite(token: string): Promise<string>;
  revokeInvite(inviteId: string): Promise<void>;
  getInvites(boardId: string): Promise<BoardInvite[]>;

  /** Live (non-deleted) items with their authors, oldest first. */
  getItems(boardId: string): Promise<BoardItemWithAuthor[]>;
  addItem(input: NewBoardItem): Promise<BoardItem>;
  updateItem(id: string, patch: BoardItemPatch, expectedVersion?: number): Promise<void>;
  deleteItem(id: string): Promise<void>;
  restoreItem(id: string): Promise<void>;

  /** Live entries, ordered for display. */
  getEntries(boardId: string): Promise<ListEntry[]>;
  addEntry(input: NewListEntry): Promise<ListEntry>;
  updateEntry(id: string, patch: ListEntryPatch, expectedVersion?: number): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  restoreEntry(id: string): Promise<void>;

  /** All assets on a board (for resolving photo URLs). */
  getAssets(boardId: string): Promise<ItemAsset[]>;

  uploadAsset(
    boardId: string,
    itemId: string,
    localUri: string,
    mime?: string,
  ): Promise<ItemAsset>;
  /** Time-boxed URL for a private asset. */
  getAssetUrl(asset: ItemAsset, expiresInSec?: number): Promise<string>;

  getEvents(boardId: string, limit?: number): Promise<BoardEvent[]>;

  getSettings(): Promise<UserSettings | null>;
  updateSettings(patch: UserSettingsPatch): Promise<UserSettings>;

  onItemsChanged(boardId: string, cb: (items: BoardItemWithAuthor[]) => void): Unsubscribe;
  onEntriesChanged(boardId: string, cb: (entries: ListEntry[]) => void): Unsubscribe;
  onAssetsChanged(boardId: string, cb: (assets: ItemAsset[]) => void): Unsubscribe;
}
