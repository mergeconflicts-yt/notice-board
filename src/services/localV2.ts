import AsyncStorage from '@react-native-async-storage/async-storage';
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
  ItemLayout,
  ItemPaper,
  ListEntry,
  ListEntryPatch,
  NewBoardItem,
  NewListEntry,
  User,
  UserSettings,
  UserSettingsPatch,
} from '../types';
import { NoticeBackendV2, VersionConflictError } from './backendV2';
import { Unsubscribe } from './backend';
import { randomId } from '../utils/id';

const STORAGE_KEY = 'noticeboard.local.v2';

type StoredInvite = BoardInvite & { token: string };

type LocalDBV2 = {
  currentUserId: string | null;
  users: Record<string, User>;
  boards: Record<string, BoardDetails>;
  members: Record<string, Record<string, BoardMembership>>;
  items: Record<string, BoardItem>;
  entries: Record<string, ListEntry>;
  assets: Record<string, ItemAsset>;
  invites: Record<string, StoredInvite>;
  events: BoardEvent[];
  settings: Record<string, UserSettings>;
};

function emptyDB(): LocalDBV2 {
  return {
    currentUserId: null,
    users: {},
    boards: {},
    members: {},
    items: {},
    entries: {},
    assets: {},
    invites: {},
    events: [],
    settings: {},
  };
}

type Listener<T> = (payload: T) => void;

class Emitter {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<T>(key: string, cb: Listener<T>): Unsubscribe {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    const set = this.listeners.get(key)!;
    set.add(cb as Listener<unknown>);
    return () => set.delete(cb as Listener<unknown>);
  }

  emit<T>(key: string, payload: T): void {
    const set = this.listeners.get(key);
    if (!set) return;
    for (const cb of Array.from(set)) {
      try {
        (cb as Listener<T>)(payload);
      } catch {
        // ignore listener errors
      }
    }
  }
}

const now = () => new Date().toISOString();

function inviteToken(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

/**
 * On-device demo backend implementing the v2 contract. Mirrors the server
 * semantics (soft deletes, versions, roles, invite uses, audit trail) so the
 * app behaves the same with or without Supabase.
 */
export class LocalBackendV2 implements NoticeBackendV2 {
  readonly mode = 'local' as const;
  private emitter = new Emitter();
  private db: LocalDBV2 = emptyDB();
  private loaded: Promise<void> | null = null;

  private async load(): Promise<void> {
    if (this.loaded) return this.loaded;
    this.loaded = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) this.db = { ...emptyDB(), ...JSON.parse(raw) };
      } catch {
        this.db = emptyDB();
      }
    })();
    return this.loaded;
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  private requireUser(): User {
    if (!this.db.currentUserId) throw new Error('No signed-in user');
    const user = this.db.users[this.db.currentUserId];
    if (!user) throw new Error('No signed-in user');
    return user;
  }

  private membership(boardId: string, userId: string) {
    return this.db.members[boardId]?.[userId] ?? null;
  }

  private requireMember(boardId: string, userId: string) {
    const m = this.membership(boardId, userId);
    if (!m) throw new Error('Not a board member');
    return m;
  }

  private logEvent(
    boardId: string,
    actorId: string | null,
    entityType: string,
    entityId: string | null,
    action: string,
    metadata: Record<string, unknown> = {},
  ) {
    this.db.events.push({
      id: randomId(),
      boardId,
      actorId,
      entityType,
      entityId,
      action,
      metadata,
      requestId: null,
      createdAt: now(),
    });
  }

  private withAuthor(item: BoardItem): BoardItemWithAuthor {
    return { ...item, author: this.db.users[item.createdBy] ?? null };
  }

  async ensureProfile(displayName: string, avatar?: string | null): Promise<User> {
    await this.load();
    const existing = this.db.currentUserId ? this.db.users[this.db.currentUserId] : undefined;
    if (existing) {
      const updated: User = { ...existing, displayName, avatar: avatar ?? existing.avatar };
      this.db.users[updated.id] = updated;
      await this.save();
      return updated;
    }
    const id = randomId();
    const created: User = { id, displayName, avatar: avatar ?? null, createdAt: now() };
    this.db.users[id] = created;
    this.db.currentUserId = id;
    await this.save();
    return created;
  }

  async getBoard(id: string): Promise<BoardDetails | null> {
    await this.load();
    const board = this.db.boards[id];
    if (!board || board.deletedAt) return null;
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(id, userId)) return null;
    return board;
  }

  async getBoards(): Promise<BoardDetails[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId) return [];
    return Object.values(this.db.boards)
      .filter((b) => !b.deletedAt && this.membership(b.id, userId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBoard(name: string): Promise<BoardDetails> {
    await this.load();
    const user = this.requireUser();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Board name is required');
    const board: BoardDetails = {
      id: randomId(),
      name: trimmed,
      ownerId: user.id,
      inviteCode: '',
      createdBy: user.id,
      createdAt: now(),
      updatedBy: user.id,
      updatedAt: now(),
      deletedBy: null,
      deletedAt: null,
      version: 1,
      settings: {},
    };
    this.db.boards[board.id] = board;
    this.db.members[board.id] = {
      [user.id]: {
        boardId: board.id,
        userId: user.id,
        role: 'owner',
        joinedAt: now(),
        invitedBy: null,
        removedBy: null,
        removedAt: null,
        leftAt: null,
        user,
      },
    };
    this.logEvent(board.id, user.id, 'board', board.id, 'insert', { after: board });
    await this.save();
    this.emitBoard(board.id);
    this.emitMembers(board.id);
    return board;
  }

  async updateBoard(
    id: string,
    patch: { name?: string; settings?: Record<string, unknown> },
    expectedVersion?: number,
  ): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const board = this.db.boards[id];
    if (!board || board.deletedAt) throw new Error('Board not found');
    this.requireMember(id, user.id);
    if (expectedVersion !== undefined && board.version !== expectedVersion) {
      throw new VersionConflictError('board', id);
    }
    const before = { ...board };
    this.db.boards[id] = {
      ...board,
      name: patch.name ?? board.name,
      settings: patch.settings ?? board.settings,
      updatedBy: user.id,
      updatedAt: now(),
      version: board.version + 1,
    };
    this.logEvent(id, user.id, 'board', id, 'update', { before, after: this.db.boards[id] });
    await this.save();
    this.emitBoard(id);
  }

  async deleteBoard(id: string): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const board = this.db.boards[id];
    if (!board || board.deletedAt) return;
    this.requireMember(id, user.id);
    const before = { ...board };
    this.db.boards[id] = {
      ...board,
      deletedBy: user.id,
      deletedAt: now(),
      updatedBy: user.id,
      updatedAt: now(),
      version: board.version + 1,
    };
    this.logEvent(id, user.id, 'board', id, 'delete', { before, after: this.db.boards[id] });
    await this.save();
    this.emitBoard(id);
  }

  async restoreBoard(id: string): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const board = this.db.boards[id];
    if (!board || !board.deletedAt) return;
    this.requireMember(id, user.id);
    const before = { ...board };
    this.db.boards[id] = {
      ...board,
      deletedBy: null,
      deletedAt: null,
      updatedBy: user.id,
      updatedAt: now(),
      version: board.version + 1,
    };
    this.logEvent(id, user.id, 'board', id, 'restore', { before, after: this.db.boards[id] });
    await this.save();
    this.emitBoard(id);
  }

  async leaveBoard(id: string): Promise<void> {
    await this.load();
    const user = this.requireUser();
    if (this.db.members[id]) delete this.db.members[id][user.id];
    await this.save();
    this.emitMembers(id);
  }

  async getMembers(boardId: string): Promise<BoardMembership[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    return Object.values(this.db.members[boardId] ?? {})
      .map((m) => ({ ...m, user: this.db.users[m.userId] }))
      .filter((m): m is BoardMembership => Boolean(m.user))
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async createInvite(
    boardId: string,
    opts?: { maxUses?: number | null; expiresAt?: string | null },
  ): Promise<CreatedInvite> {
    await this.load();
    const user = this.requireUser();
    this.requireMember(boardId, user.id);
    const maxUses = opts?.maxUses ?? null;
    if (maxUses !== null && maxUses < 1) throw new Error('maxUses must be positive');
    if (opts?.expiresAt && new Date(opts.expiresAt).getTime() <= Date.now()) {
      throw new Error('Expiry must be in the future');
    }
    const token = inviteToken();
    const invite: StoredInvite = {
      id: randomId(),
      boardId,
      createdBy: user.id,
      createdAt: now(),
      expiresAt: opts?.expiresAt ?? null,
      maxUses,
      useCount: 0,
      acceptedBy: null,
      acceptedAt: null,
      revokedBy: null,
      revokedAt: null,
      token,
    };
    this.db.invites[invite.id] = invite;
    await this.save();
    const { token: _secret, ...publicInvite } = invite;
    return { invite: publicInvite, token };
  }

  async acceptInvite(token: string): Promise<string> {
    await this.load();
    const user = this.requireUser();
    const norm = token.trim().toUpperCase().replace(/[\s-]+/g, '');
    const invite = Object.values(this.db.invites).find(
      (inv) => inv.token.replace(/-/g, '') === norm,
    );
    if (
      !invite ||
      invite.revokedBy ||
      (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now())
    ) {
      throw new Error('This invite is not valid');
    }
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      throw new Error('This invite has already been fully used');
    }
    const existing = this.membership(invite.boardId, user.id);
    if (!existing) {
      if (!this.db.members[invite.boardId]) this.db.members[invite.boardId] = {};
      this.db.members[invite.boardId][user.id] = {
        boardId: invite.boardId,
        userId: user.id,
        role: 'member',
        joinedAt: now(),
        invitedBy: invite.createdBy,
        removedBy: null,
        removedAt: null,
        leftAt: null,
        user,
      };
      invite.useCount += 1;
      invite.acceptedBy = invite.acceptedBy ?? user.id;
      invite.acceptedAt = invite.acceptedAt ?? now();
      this.logEvent(invite.boardId, user.id, 'member', user.id, 'insert', {});
      this.emitMembers(invite.boardId);
    }
    await this.save();
    return invite.boardId;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const invite = this.db.invites[inviteId];
    if (!invite) throw new Error('Invite not found');
    this.requireMember(invite.boardId, user.id);
    if (!invite.revokedBy) {
      invite.revokedBy = user.id;
      invite.revokedAt = now();
      await this.save();
    }
  }

  async getInvites(boardId: string): Promise<BoardInvite[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    return Object.values(this.db.invites)
      .filter((inv) => inv.boardId === boardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ token: _secret, ...rest }) => rest);
  }

  async getItems(boardId: string): Promise<BoardItemWithAuthor[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    const cutoff = Date.now();
    return Object.values(this.db.items)
      .filter(
        (n) =>
          n.boardId === boardId &&
          !n.deletedAt &&
          (!n.expiresAt || new Date(n.expiresAt).getTime() > cutoff),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((n) => this.withAuthor(n));
  }

  async addItem(input: NewBoardItem): Promise<BoardItem> {
    await this.load();
    const user = this.requireUser();
    this.requireMember(input.boardId, user.id);
    const item: BoardItem = {
      id: randomId(),
      boardId: input.boardId,
      type: input.type,
      body: input.body ?? null,
      eventAt: input.eventAt ?? null,
      expiresAt: input.expiresAt ?? null,
      paper: {
        color: input.paper?.color ?? 'yellow',
        rotation: input.paper?.rotation ?? 0,
      },
      layout: input.layout ?? null,
      createdBy: user.id,
      createdAt: now(),
      updatedBy: user.id,
      updatedAt: now(),
      completedBy: null,
      completedAt: null,
      deletedBy: null,
      deletedAt: null,
      version: 1,
    };
    this.db.items[item.id] = item;
    this.logEvent(input.boardId, user.id, 'item', item.id, 'insert', { after: item });
    await this.save();
    this.emitItems(input.boardId);
    return item;
  }

  async updateItem(id: string, patch: BoardItemPatch, expectedVersion?: number): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const item = this.db.items[id];
    if (!item) return;
    this.requireMember(item.boardId, user.id);
    if (expectedVersion !== undefined && item.version !== expectedVersion) {
      throw new VersionConflictError('item', id);
    }
    const before = { ...item };
    const next: BoardItem = {
      ...item,
      body: patch.body !== undefined ? patch.body : item.body,
      eventAt: patch.eventAt !== undefined ? patch.eventAt : item.eventAt,
      expiresAt: patch.expiresAt !== undefined ? patch.expiresAt : item.expiresAt,
      paper: patch.paper ? { ...item.paper, ...patch.paper } : item.paper,
      layout: patch.layout !== undefined ? patch.layout : item.layout,
      completedAt: patch.completedAt !== undefined ? patch.completedAt : item.completedAt,
      deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : item.deletedAt,
      updatedBy: user.id,
      updatedAt: now(),
      version: item.version + 1,
    };
    if (patch.completedAt !== undefined) {
      next.completedBy = patch.completedAt ? user.id : null;
    }
    if (patch.deletedAt !== undefined) {
      next.deletedBy = patch.deletedAt ? user.id : null;
    }
    this.db.items[id] = next;
    const action =
      patch.deletedAt !== undefined && before.deletedAt !== next.deletedAt
        ? next.deletedAt
          ? 'delete'
          : 'restore'
        : 'update';
    this.logEvent(item.boardId, user.id, 'item', id, action, { before, after: next });
    await this.save();
    this.emitItems(item.boardId);
  }

  async deleteItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: now() });
  }

  async restoreItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: null });
  }

  async getEntries(boardId: string): Promise<ListEntry[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    return Object.values(this.db.entries)
      .filter((e) => e.boardId === boardId && !e.deletedAt)
      .sort((a, b) => a.itemId.localeCompare(b.itemId) || a.position - b.position);
  }

  async addListItem(input: {
    boardId: string;
    body?: string | null;
    paper?: Partial<ItemPaper> | null;
    layout?: ItemLayout;
    expiresAt?: string | null;
    entries: { text: string; position?: number; done?: boolean }[];
  }): Promise<string> {
    await this.load();
    const user = this.requireUser();
    this.requireMember(input.boardId, user.id);
    const item: BoardItem = {
      id: randomId(),
      boardId: input.boardId,
      type: 'list',
      body: input.body ?? null,
      eventAt: null,
      expiresAt: input.expiresAt ?? null,
      paper: {
        color: input.paper?.color ?? 'yellow',
        rotation: input.paper?.rotation ?? 0,
      },
      layout: input.layout ?? null,
      createdBy: user.id,
      createdAt: now(),
      updatedBy: user.id,
      updatedAt: now(),
      completedBy: null,
      completedAt: null,
      deletedBy: null,
      deletedAt: null,
      version: 1,
    };
    this.db.items[item.id] = item;
    this.logEvent(input.boardId, user.id, 'item', item.id, 'insert', { after: item });
    input.entries.forEach((e, i) => {
      const entry: ListEntry = {
        id: randomId(),
        boardId: input.boardId,
        itemId: item.id,
        text: e.text,
        position: e.position ?? i,
        isChecked: e.done ?? false,
        checkedBy: e.done ? user.id : null,
        checkedAt: e.done ? now() : null,
        createdBy: user.id,
        createdAt: now(),
        updatedBy: user.id,
        updatedAt: now(),
        deletedBy: null,
        deletedAt: null,
        version: 1,
      };
      this.db.entries[entry.id] = entry;
      this.logEvent(input.boardId, user.id, 'entry', entry.id, 'insert', { after: entry });
    });
    await this.save();
    this.emitItems(input.boardId);
    this.emitEntries(input.boardId);
    return item.id;
  }

  async addEntry(input: NewListEntry): Promise<ListEntry> {
    await this.load();
    const user = this.requireUser();
    this.requireMember(input.boardId, user.id);
    const item = this.db.items[input.itemId];
    if (!item || item.boardId !== input.boardId) throw new Error('Item not found');
    const position =
      input.position ??
      Math.max(-1, ...Object.values(this.db.entries)
        .filter((e) => e.itemId === input.itemId)
        .map((e) => e.position)) + 1;
    const entry: ListEntry = {
      id: randomId(),
      boardId: input.boardId,
      itemId: input.itemId,
      text: input.text,
      position,
      isChecked: false,
      checkedBy: null,
      checkedAt: null,
      createdBy: user.id,
      createdAt: now(),
      updatedBy: user.id,
      updatedAt: now(),
      deletedBy: null,
      deletedAt: null,
      version: 1,
    };
    this.db.entries[entry.id] = entry;
    this.logEvent(input.boardId, user.id, 'entry', entry.id, 'insert', { after: entry });
    await this.save();
    this.emitEntries(input.boardId);
    return entry;
  }

  async updateEntry(id: string, patch: ListEntryPatch, expectedVersion?: number): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const entry = this.db.entries[id];
    if (!entry) return;
    this.requireMember(entry.boardId, user.id);
    if (expectedVersion !== undefined && entry.version !== expectedVersion) {
      throw new VersionConflictError('entry', id);
    }
    const before = { ...entry };
    const next: ListEntry = {
      ...entry,
      text: patch.text ?? entry.text,
      position: patch.position ?? entry.position,
      isChecked: patch.isChecked ?? entry.isChecked,
      deletedAt: patch.deletedAt !== undefined ? patch.deletedAt : entry.deletedAt,
      updatedBy: user.id,
      updatedAt: now(),
      version: entry.version + 1,
    };
    if (patch.isChecked !== undefined && patch.isChecked !== before.isChecked) {
      next.checkedBy = user.id;
      next.checkedAt = now();
    }
    if (patch.deletedAt !== undefined) {
      next.deletedBy = patch.deletedAt ? user.id : null;
    }
    this.db.entries[id] = next;
    const action =
      patch.deletedAt !== undefined && before.deletedAt !== next.deletedAt
        ? next.deletedAt
          ? 'delete'
          : 'restore'
        : 'update';
    this.logEvent(entry.boardId, user.id, 'entry', id, action, { before, after: next });
    await this.save();
    this.emitEntries(entry.boardId);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.updateEntry(id, { deletedAt: now() });
  }

  async restoreEntry(id: string): Promise<void> {
    await this.updateEntry(id, { deletedAt: null });
  }

  async uploadAsset(
    boardId: string,
    itemId: string,
    localUri: string,
    mime?: string,
  ): Promise<ItemAsset> {
    await this.load();
    const user = this.requireUser();
    this.requireMember(boardId, user.id);
    const item = this.db.items[itemId];
    if (!item || item.boardId !== boardId) throw new Error('Item not found');
    const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
    const asset: ItemAsset = {
      id: randomId(),
      boardId,
      itemId,
      storagePath: localUri,
      mime: mime ?? `image/${ext === 'png' ? 'png' : 'jpeg'}`,
      bytes: null,
      width: null,
      height: null,
      blurhash: null,
      uploadedBy: user.id,
      uploadedAt: now(),
    };
    this.db.assets[asset.id] = asset;
    this.logEvent(boardId, user.id, 'asset', asset.id, 'insert', { after: asset });
    await this.save();
    this.emitAssets(boardId);
    return asset;
  }

  async getAssets(boardId: string): Promise<ItemAsset[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    return Object.values(this.db.assets).filter((a) => a.boardId === boardId);
  }

  async deleteAsset(id: string): Promise<void> {
    await this.load();
    const user = this.requireUser();
    const asset = this.db.assets[id];
    if (!asset) return;
    this.requireMember(asset.boardId, user.id);
    delete this.db.assets[id];
    this.logEvent(asset.boardId, user.id, 'asset', id, 'delete', { before: asset });
    await this.save();
    this.emitAssets(asset.boardId);
  }

  async getAssetUrl(asset: ItemAsset): Promise<string> {
    await this.load();
    return asset.storagePath;
  }

  async getEvents(boardId: string, limit = 50): Promise<BoardEvent[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId || !this.membership(boardId, userId)) return [];
    return this.db.events
      .filter((e) => e.boardId === boardId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getSettings(): Promise<UserSettings | null> {
    await this.load();
    if (!this.db.currentUserId) return null;
    return this.db.settings[this.db.currentUserId] ?? null;
  }

  async updateSettings(patch: UserSettingsPatch): Promise<UserSettings> {
    await this.load();
    const user = this.requireUser();
    const next: UserSettings = {
      userId: user.id,
      lastBoardId: patch.lastBoardId ?? this.db.settings[user.id]?.lastBoardId ?? null,
      locale: patch.locale ?? this.db.settings[user.id]?.locale ?? null,
      timezone: patch.timezone ?? this.db.settings[user.id]?.timezone ?? null,
      theme: patch.theme ?? this.db.settings[user.id]?.theme ?? 'system',
      reduceMotion: patch.reduceMotion ?? this.db.settings[user.id]?.reduceMotion ?? false,
    };
    this.db.settings[user.id] = next;
    await this.save();
    return next;
  }

  onItemsChanged(boardId: string, cb: (items: BoardItemWithAuthor[]) => void): Unsubscribe {
    return this.emitter.on(`items:${boardId}`, () => {
      this.getItems(boardId).then(cb);
    });
  }

  onEntriesChanged(boardId: string, cb: (entries: ListEntry[]) => void): Unsubscribe {
    return this.emitter.on(`entries:${boardId}`, () => {
      this.getEntries(boardId).then(cb);
    });
  }

  onAssetsChanged(boardId: string, cb: (assets: ItemAsset[]) => void): Unsubscribe {
    return this.emitter.on(`assets:${boardId}`, () => {
      this.getAssets(boardId).then(cb);
    });
  }

  onBoardChanged(boardId: string, cb: (board: BoardDetails | null) => void): Unsubscribe {
    return this.emitter.on(`board:${boardId}`, () => {
      this.getBoard(boardId).then(cb);
    });
  }

  onMembersChanged(boardId: string, cb: (members: BoardMembership[]) => void): Unsubscribe {
    return this.emitter.on(`members:${boardId}`, () => {
      this.getMembers(boardId).then(cb);
    });
  }

  private emitItems(boardId: string): void {
    this.emitter.emit(`items:${boardId}`, null);
  }

  private emitEntries(boardId: string): void {
    this.emitter.emit(`entries:${boardId}`, null);
  }

  private emitAssets(boardId: string): void {
    this.emitter.emit(`assets:${boardId}`, null);
  }

  private emitBoard(boardId: string): void {
    this.emitter.emit(`board:${boardId}`, null);
  }

  private emitMembers(boardId: string): void {
    this.emitter.emit(`members:${boardId}`, null);
  }
}
