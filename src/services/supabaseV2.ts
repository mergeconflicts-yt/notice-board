import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { File as ExpoFile } from 'expo-file-system';
import {
  BoardDetails,
  BoardEvent,
  BoardInvite,
  BoardItem,
  BoardItemPatch,
  BoardItemType,
  BoardItemWithAuthor,
  BoardMembership,
  BoardRole,
  CreatedInvite,
  ItemAsset,
  ItemLayout,
  ItemPaper,
  ListEntry,
  ListEntryPatch,
  NewBoardItem,
  NewListEntry,
  NoteColor,
  User,
  UserSettings,
  UserSettingsPatch,
} from '../types';
import { NoticeBackendV2, VersionConflictError } from './backendV2';
import { Unsubscribe } from './backend';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

type ProfileRow = {
  id: string;
  display_name: string;
  avatar: string | null;
  created_at: string;
};

type BoardRow = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  created_by: string | null;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  version: number;
  settings: Record<string, unknown> | null;
};

type MemberRow = {
  board_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  invited_by: string | null;
  removed_by: string | null;
  removed_at: string | null;
  left_at: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
};

type ItemRow = {
  id: string;
  board_id: string;
  type: string;
  body: string | null;
  event_at: string | null;
  expires_at: string | null;
  paper: { color?: unknown; rotation?: unknown } | null;
  layout: { x?: unknown; y?: unknown; manual?: unknown } | null;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  version: number;
  profiles: ProfileRow | ProfileRow[] | null;
};

type EntryRow = {
  id: string;
  board_id: string;
  item_id: string;
  text: string;
  position: number;
  is_checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  deleted_by: string | null;
  deleted_at: string | null;
  version: number;
};

type AssetRow = {
  id: string;
  board_id: string;
  item_id: string;
  storage_path: string;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
};

type InviteRow = {
  id: string;
  board_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  accepted_by: string | null;
  accepted_at: string | null;
  revoked_by: string | null;
  revoked_at: string | null;
};

type EventRow = {
  id: string;
  board_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
};

type SettingsRow = {
  user_id: string;
  last_board_id: string | null;
  locale: string | null;
  timezone: string | null;
  theme: string;
  reduce_motion: boolean;
};

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

function pickProfile(profiles: ProfileRow | ProfileRow[] | null): User | null {
  if (!profiles) return null;
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p ? mapProfile(p) : null;
}

function mapBoard(row: BoardRow): BoardDetails {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    deletedBy: row.deleted_by,
    deletedAt: row.deleted_at,
    version: row.version ?? 1,
    settings: row.settings ?? {},
  };
}

function mapPaper(raw: ItemRow['paper']): ItemPaper {
  const colors: NoteColor[] = ['yellow', 'green', 'pink', 'blue', 'lavender'];
  const color = colors.includes(raw?.color as NoteColor)
    ? (raw?.color as NoteColor)
    : 'yellow';
  return {
    color,
    rotation: typeof raw?.rotation === 'number' ? raw.rotation : 0,
  };
}

function mapItem(row: ItemRow): BoardItemWithAuthor {
  const rawLayout = row.layout;
  return {
    id: row.id,
    boardId: row.board_id,
    type: (['note', 'photo', 'list', 'date'] as BoardItemType[]).includes(row.type as BoardItemType)
      ? (row.type as BoardItemType)
      : 'note',
    body: row.body,
    eventAt: row.event_at,
    expiresAt: row.expires_at,
    paper: mapPaper(row.paper),
    layout:
      rawLayout && typeof rawLayout.x === 'number' && typeof rawLayout.y === 'number'
        ? { x: rawLayout.x, y: rawLayout.y, manual: rawLayout.manual === true }
        : null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    deletedBy: row.deleted_by,
    deletedAt: row.deleted_at,
    version: row.version ?? 1,
    author: pickProfile(row.profiles),
  };
}

function mapEntry(row: EntryRow): ListEntry {
  return {
    id: row.id,
    boardId: row.board_id,
    itemId: row.item_id,
    text: row.text,
    position: row.position ?? 0,
    isChecked: !!row.is_checked,
    checkedBy: row.checked_by,
    checkedAt: row.checked_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    deletedBy: row.deleted_by,
    deletedAt: row.deleted_at,
    version: row.version ?? 1,
  };
}

function mapAsset(row: AssetRow): ItemAsset {
  return {
    id: row.id,
    boardId: row.board_id,
    itemId: row.item_id,
    storagePath: row.storage_path,
    mime: row.mime,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at,
  };
}

function mapInvite(row: InviteRow): BoardInvite {
  return {
    id: row.id,
    boardId: row.board_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    useCount: row.use_count ?? 0,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    revokedBy: row.revoked_by,
    revokedAt: row.revoked_at,
  };
}

function mapEvent(row: EventRow): BoardEvent {
  return {
    id: row.id,
    boardId: row.board_id,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    metadata: row.metadata ?? {},
    requestId: row.request_id,
    createdAt: row.created_at,
  };
}

function mapMembership(row: MemberRow): BoardMembership {
  const roles: BoardRole[] = ['owner', 'admin', 'member'];
  return {
    boardId: row.board_id,
    userId: row.user_id,
    role: roles.includes(row.role as BoardRole) ? (row.role as BoardRole) : 'member',
    joinedAt: row.joined_at,
    invitedBy: row.invited_by,
    removedBy: row.removed_by,
    removedAt: row.removed_at,
    leftAt: row.left_at,
    user: pickProfile(row.profiles)!,
  };
}

function mapSettings(row: SettingsRow): UserSettings {
  const themes = ['system', 'light', 'dark'] as const;
  return {
    userId: row.user_id,
    lastBoardId: row.last_board_id,
    locale: row.locale,
    timezone: row.timezone,
    theme: (themes as readonly string[]).includes(row.theme)
      ? (row.theme as UserSettings['theme'])
      : 'system',
    reduceMotion: !!row.reduce_motion,
  };
}

/** Strip undefined values so partial patches only touch the given columns. */
function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Minimal key/value surface the auth layer needs (AsyncStorage-compatible). */
export type AuthStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

export class SupabaseBackendV2 implements NoticeBackendV2 {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor(storage?: AuthStorage) {
    this.client = createClient(url!, anonKey!, {
      auth: {
        storage: (storage ?? AsyncStorage) as never,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  private async requireUser() {
    let {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) {
      // Same recovery as v1: a missing session means a fresh anonymous
      // identity (the old one is unrecoverable by design).
      console.warn('v2: session missing, signing in anonymously');
      const { data: signIn, error: signInError } = await this.client.auth.signInAnonymously();
      if (signInError) throw signInError;
      user = signIn.user;
    }
    if (!user) throw new Error('Could not start a session. Check your connection and try again.');
    return user;
  }

  async ensureProfile(displayName: string, avatar?: string | null): Promise<User> {
    const user = await this.requireUser();
    const { data, error } = await this.client
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName, avatar: avatar ?? null }, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapProfile(data as ProfileRow);
  }

  async getBoard(id: string): Promise<BoardDetails | null> {
    const { data } = await this.client.from('boards').select('*').eq('id', id).maybeSingle();
    if (!data || (data as BoardRow).deleted_at) return null;
    return mapBoard(data as BoardRow);
  }

  async getBoards(): Promise<BoardDetails[]> {
    const user = await this.requireUser();
    const { data, error } = await this.client
      .from('board_members')
      .select('joined_at, boards(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return (
      (data as { joined_at: string; boards: BoardRow | BoardRow[] | null }[] | null)?.flatMap((row) => {
        const b = Array.isArray(row.boards) ? row.boards[0] : row.boards;
        return b && !b.deleted_at ? [mapBoard(b)] : [];
      }) ?? []
    );
  }

  async createBoard(name: string): Promise<BoardDetails> {
    await this.requireUser();
    // Membership is created server-side by the RPC; clients cannot insert it.
    const { data, error } = await this.client.rpc('create_board', { p_name: name });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as BoardRow;
    if (!row) throw new Error('Board was not created');
    return mapBoard(row);
  }

  async updateBoard(
    id: string,
    patch: { name?: string; settings?: Record<string, unknown> },
    expectedVersion?: number,
  ): Promise<void> {
    let q = this.client.from('boards').update(defined({ name: patch.name, settings: patch.settings }));
    if (expectedVersion !== undefined) q = q.eq('version', expectedVersion);
    const query = expectedVersion !== undefined ? q.select('id') : q;
    const { data, error } = await query.eq('id', id);
    if (error) throw error;
    if (expectedVersion !== undefined && (!data || (data as unknown[]).length === 0)) {
      throw new VersionConflictError('board', id);
    }
  }

  async deleteBoard(id: string): Promise<void> {
    const { error } = await this.client
      .from('boards')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async restoreBoard(id: string): Promise<void> {
    const { error } = await this.client.from('boards').update({ deleted_at: null }).eq('id', id);
    if (error) throw error;
  }

  async leaveBoard(id: string): Promise<void> {
    const user = await this.requireUser();
    await this.client.from('board_members').delete().eq('board_id', id).eq('user_id', user.id);
  }

  async getMembers(boardId: string): Promise<BoardMembership[]> {
    const { data, error } = await this.client
      .from('board_members')
      .select('*, profiles(*)')
      .eq('board_id', boardId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return (data as MemberRow[]).map(mapMembership);
  }

  onBoardChanged(boardId: string, cb: (board: BoardDetails | null) => void): Unsubscribe {
    const channel = this.client
      .channel(`v2-board-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'boards', filter: `id=eq.${boardId}` },
        () => {
          this.getBoard(boardId).then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  onMembersChanged(boardId: string, cb: (members: BoardMembership[]) => void): Unsubscribe {
    const channel = this.client
      .channel(`v2-members-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_members', filter: `board_id=eq.${boardId}` },
        () => {
          this.getMembers(boardId).then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  async createInvite(
    boardId: string,
    opts?: { maxUses?: number | null; expiresAt?: string | null },
  ): Promise<CreatedInvite> {
    const { data, error } = await this.client.rpc('create_board_invite', {
      p_board_id: boardId,
      p_max_uses: opts?.maxUses ?? null,
      p_expires_at: opts?.expiresAt ?? null,
    });
    if (error) throw error;
    const row = (data as { invite_id: string; token: string }[])[0];
    if (!row) throw new Error('Invite was not created');
    const { data: invite, error: inviteError } = await this.client
      .from('board_invites')
      .select('*')
      .eq('id', row.invite_id)
      .single();
    if (inviteError) throw inviteError;
    return { invite: mapInvite(invite as InviteRow), token: row.token };
  }

  async acceptInvite(token: string): Promise<string> {
    const { data, error } = await this.client.rpc('accept_board_invite', { p_token: token });
    if (error) throw error;
    return data as string;
  }

  async revokeInvite(inviteId: string): Promise<void> {
    const { error } = await this.client.rpc('revoke_board_invite', { p_invite_id: inviteId });
    if (error) throw error;
  }

  async getInvites(boardId: string): Promise<BoardInvite[]> {
    const { data, error } = await this.client
      .from('board_invites')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data as InviteRow[]) ?? []).map(mapInvite);
  }

  async getItems(boardId: string): Promise<BoardItemWithAuthor[]> {
    const { data, error } = await this.client
      .from('board_items')
      .select('*, profiles(*)')
      .eq('board_id', boardId)
      .is('deleted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data as ItemRow[]) ?? []).map(mapItem);
  }

  async addItem(input: NewBoardItem): Promise<BoardItem> {
    const { data, error } = await this.client
      .from('board_items')
      .insert(
        defined({
          board_id: input.boardId,
          type: input.type,
          body: input.body ?? null,
          event_at: input.eventAt ?? null,
          expires_at: input.expiresAt ?? null,
          paper: input.paper ?? {},
          layout: input.layout ?? null,
        }),
      )
      .select('*')
      .single();
    if (error) throw error;
    const { author: _omit, ...item } = mapItem({ ...(data as ItemRow), profiles: null });
    return item;
  }

  async updateItem(id: string, patch: BoardItemPatch, expectedVersion?: number): Promise<void> {
    const update = defined({
      body: patch.body,
      event_at: patch.eventAt,
      expires_at: patch.expiresAt,
      paper: patch.paper,
      layout: patch.layout,
      completed_at: patch.completedAt,
      deleted_at: patch.deletedAt,
    });
    let q = this.client.from('board_items').update(update);
    if (expectedVersion !== undefined) q = q.eq('version', expectedVersion);
    const query = expectedVersion !== undefined ? q.select('id') : q;
    const { data, error } = await query.eq('id', id);
    if (error) throw error;
    if (expectedVersion !== undefined && (!data || (data as unknown[]).length === 0)) {
      throw new VersionConflictError('item', id);
    }
  }

  async deleteItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: new Date().toISOString() });
  }

  async restoreItem(id: string): Promise<void> {
    await this.updateItem(id, { deletedAt: null });
  }

  async getEntries(boardId: string): Promise<ListEntry[]> {
    const { data, error } = await this.client
      .from('list_entries')
      .select('*')
      .eq('board_id', boardId)
      .is('deleted_at', null)
      .order('item_id', { ascending: true })
      .order('position', { ascending: true });
    if (error) throw error;
    return ((data as EntryRow[]) ?? []).map(mapEntry);
  }

  async addListItem(input: {
    boardId: string;
    body?: string | null;
    paper?: Partial<ItemPaper> | null;
    layout?: ItemLayout;
    expiresAt?: string | null;
    entries: { text: string; position?: number; done?: boolean }[];
  }): Promise<string> {
    const { data, error } = await this.client.rpc('create_list_item', {
      p_board_id: input.boardId,
      p_body: input.body ?? null,
      p_paper: input.paper ?? {},
      p_layout: input.layout ?? null,
      p_expires_at: input.expiresAt ?? null,
      p_entries: input.entries.map((e, i) => ({
        text: e.text,
        position: e.position ?? i,
        done: e.done ?? false,
      })),
    });
    if (error) throw error;
    return data as string;
  }

  async addEntry(input: NewListEntry): Promise<ListEntry> {
    let position = input.position;
    if (position === undefined) {
      const { data: last } = await this.client
        .from('list_entries')
        .select('position')
        .eq('item_id', input.itemId)
        .order('position', { ascending: false })
        .limit(1);
      position = ((last as { position: number }[] | null)?.[0]?.position ?? -1) + 1;
    }
    const { data, error } = await this.client
      .from('list_entries')
      .insert({ board_id: input.boardId, item_id: input.itemId, text: input.text, position })
      .select('*')
      .single();
    if (error) throw error;
    return mapEntry(data as EntryRow);
  }

  async updateEntry(id: string, patch: ListEntryPatch, expectedVersion?: number): Promise<void> {
    const update = defined({
      text: patch.text,
      position: patch.position,
      is_checked: patch.isChecked,
      deleted_at: patch.deletedAt,
    });
    let q = this.client.from('list_entries').update(update);
    if (expectedVersion !== undefined) q = q.eq('version', expectedVersion);
    const query = expectedVersion !== undefined ? q.select('id') : q;
    const { data, error } = await query.eq('id', id);
    if (error) throw error;
    if (expectedVersion !== undefined && (!data || (data as unknown[]).length === 0)) {
      throw new VersionConflictError('entry', id);
    }
  }

  async deleteEntry(id: string): Promise<void> {
    await this.updateEntry(id, { deletedAt: new Date().toISOString() });
  }

  async restoreEntry(id: string): Promise<void> {
    await this.updateEntry(id, { deletedAt: null });
  }

  async getAssets(boardId: string): Promise<ItemAsset[]> {
    const { data, error } = await this.client
      .from('item_assets')
      .select('*')
      .eq('board_id', boardId);
    if (error) throw error;
    return ((data as AssetRow[]) ?? []).map(mapAsset);
  }

  async uploadAsset(
    boardId: string,
    itemId: string,
    localUri: string,
    mime?: string,
  ): Promise<ItemAsset> {
    const ext = localUri.split('.').pop()?.split('?')[0] || 'jpg';
    const type = mime ?? `image/${ext === 'png' ? 'png' : 'jpeg'}`;
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const path = `board/${boardId}/item/${itemId}/${name}`;
    // Read the bytes up front and upload a real binary body — no FormData
    // `{uri}` hacks.
    const bytes = await new ExpoFile(localUri).arrayBuffer();
    const { error } = await this.client.storage.from('board-media').upload(path, bytes, {
      contentType: type,
      upsert: false,
    });
    if (error) throw error;
    const { data, error: rowError } = await this.client
      .from('item_assets')
      .insert({
        board_id: boardId,
        item_id: itemId,
        storage_path: path,
        mime: type,
        bytes: bytes.byteLength,
      })
      .select('*')
      .single();
    if (rowError) {
      // Don't orphan bytes when the row insert fails.
      await this.client.storage.from('board-media').remove([path]).catch(() => {});
      throw rowError;
    }
    return mapAsset(data as AssetRow);
  }

  async deleteAsset(id: string): Promise<void> {
    const { data, error } = await this.client
      .from('item_assets')
      .select('storage_path')
      .eq('id', id)
      .single();
    if (error) throw error;
    const path = (data as { storage_path: string }).storage_path;
    const { error: storageError } = await this.client.storage.from('board-media').remove([path]);
    if (storageError) console.error('remove asset bytes failed', storageError);
    const { error: rowError } = await this.client.from('item_assets').delete().eq('id', id);
    if (rowError) throw rowError;
  }

  async getAssetUrl(asset: ItemAsset, expiresInSec = 3600): Promise<string> {
    const { data, error } = await this.client.storage
      .from('board-media')
      .createSignedUrl(asset.storagePath, expiresInSec);
    if (error || !data?.signedUrl) throw error ?? new Error('Could not sign asset URL');
    return data.signedUrl;
  }

  async getEvents(boardId: string, limit = 50): Promise<BoardEvent[]> {
    const { data, error } = await this.client
      .from('board_events')
      .select('*')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data as EventRow[]) ?? []).map(mapEvent);
  }

  async getSettings(): Promise<UserSettings | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return null;
    const { data } = await this.client
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    return data ? mapSettings(data as SettingsRow) : null;
  }

  async updateSettings(patch: UserSettingsPatch): Promise<UserSettings> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await this.client
      .from('user_settings')
      .upsert(
        defined({
          user_id: user.id,
          last_board_id: patch.lastBoardId,
          locale: patch.locale,
          timezone: patch.timezone,
          theme: patch.theme,
          reduce_motion: patch.reduceMotion,
        }),
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapSettings(data as SettingsRow);
  }

  onItemsChanged(boardId: string, cb: (items: BoardItemWithAuthor[]) => void): Unsubscribe {
    const channel = this.client
      .channel(`v2-items-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_items', filter: `board_id=eq.${boardId}` },
        () => {
          this.getItems(boardId).then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  onEntriesChanged(boardId: string, cb: (entries: ListEntry[]) => void): Unsubscribe {
    const channel = this.client
      .channel(`v2-entries-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_entries', filter: `board_id=eq.${boardId}` },
        () => {
          this.getEntries(boardId).then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  onAssetsChanged(boardId: string, cb: (assets: ItemAsset[]) => void): Unsubscribe {
    const getAssets = async (): Promise<ItemAsset[]> => {
      const { data, error } = await this.client
        .from('item_assets')
        .select('*')
        .eq('board_id', boardId);
      if (error) throw error;
      return ((data as AssetRow[]) ?? []).map(mapAsset);
    };
    const channel = this.client
      .channel(`v2-assets-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_assets', filter: `board_id=eq.${boardId}` },
        () => {
          getAssets().then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }
}
