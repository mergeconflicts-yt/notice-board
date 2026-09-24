import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { preparePhoto } from './photos';
import {
  Board,
  BoardColor,
  BoardMember,
  InviteLink,
  InvitePreview,
  ItemColor,
  ItemType,
  ItemWithAuthor,
  ListEntry,
  MemberRole,
  User,
} from '../types';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Stable error codes raised by the database functions. */
export type ApiErrorCode =
  | 'not_authenticated'
  | 'not_member'
  | 'not_owner'
  | 'not_author'
  | 'not_found'
  | 'invalid_input'
  | 'version_conflict'
  | 'rate_limited'
  | 'invite_invalid';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode | 'unknown' | 'network',
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CODES: ApiErrorCode[] = [
  'not_authenticated',
  'not_member',
  'not_owner',
  'not_author',
  'not_found',
  'invalid_input',
  'version_conflict',
  'rate_limited',
  'invite_invalid',
];

function classify(message: string | undefined): ApiErrorCode | 'unknown' {
  const found = CODES.find((c) => (message ?? '').includes(c));
  return found ?? 'unknown';
}

/** Friendly copy for each failure the app can actually surface. */
export function friendlyMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }
  switch (error.code) {
    case 'not_authenticated':
      return 'Please try again in a moment.';
    case 'not_member':
    case 'not_found':
      return 'This is no longer available.';
    case 'not_owner':
      return 'Only the board owner can do that.';
    case 'not_author':
      return 'Only the person who wrote it can change the text.';
    case 'invalid_input':
      return 'That doesn\'t look right. Please check and try again.';
    case 'version_conflict':
      return 'Someone just changed this. Reloading the latest version.';
    case 'rate_limited':
      return 'You\'re doing that too quickly. Please wait a moment.';
    case 'invite_invalid':
      return 'That invite isn\'t working. Ask for a fresh link.';
    case 'network':
      return 'Can\'t reach the board. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function raise(error: { message?: string } | null): never {
  throw new ApiError(classify(error?.message), error?.message ?? 'unknown error');
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
};

function mapUser(row: ProfileRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    createdAt: row.created_at,
  };
}

function firstProfile(value: ProfileRow | ProfileRow[] | null): User | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  return row ? mapUser(row) : null;
}

function mapBoard(row: any): Board {
  return {
    id: row.id,
    name: row.name,
    color: row.color as BoardColor,
    timezone: row.timezone,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapItem(row: any): ItemWithAuthor {
  const author = firstProfile(row.author ?? row.profiles ?? null);
  return {
    id: row.id,
    boardId: row.board_id,
    type: row.type as ItemType,
    color: row.color as ItemColor,
    body: row.body,
    title: row.title,
    eventAt: row.event_at,
    place: row.place,
    photoPath: row.photo_path,
    layout:
      row.layout && typeof row.layout.x === 'number' && typeof row.layout.y === 'number'
        ? { x: row.layout.x, y: row.layout.y, manual: row.layout.manual === true }
        : null,
    pinned: row.pinned,
    keepUntil: row.keep_until,
    doneAt: row.done_at,
    doneBy: row.done_by,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author,
  };
}

function mapEntry(row: any): ListEntry {
  return {
    id: row.id,
    itemId: row.item_id,
    boardId: row.board_id,
    text: row.text,
    position: row.position,
    checkedAt: row.checked_at,
    checkedBy: row.checked_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ITEM_SELECT = '*, author:profiles!items_created_by_fkey(*)';

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getMyBoards(): Promise<Board[]> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) raise(error);
  return (data ?? []).map(mapBoard);
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('id', boardId)
    .maybeSingle();
  if (error) raise(error);
  if (!data) return null;
  const board = mapBoard(data);
  return board.deletedAt ? null : board;
}

export async function getMembers(boardId: string): Promise<BoardMember[]> {
  const { data, error } = await supabase
    .from('board_members')
    .select('*, profiles!board_members_user_id_fkey(*)')
    .eq('board_id', boardId)
    .order('joined_at', { ascending: true });
  if (error) raise(error);
  return (data ?? []).map((row: any) => ({
    boardId: row.board_id,
    userId: row.user_id,
    role: row.role as MemberRole,
    joinedAt: row.joined_at,
    user: firstProfile(row.profiles) ?? {
      id: row.user_id,
      displayName: 'Former member',
      avatarPath: null,
      createdAt: row.joined_at,
    },
  }));
}

/** Full board content: live items (not deleted, not expired) + all entries. */
export async function getBoardContent(
  boardId: string,
): Promise<{ items: ItemWithAuthor[]; entries: ListEntry[] }> {
  // Live = not deleted AND (no expiry OR expiry in the future). The `now`
  // must be evaluated per call, and the two conditions are AND-ed — an `.or()`
  // over all three would resurrect a removed-but-unexpired post.
  const nowIso = new Date().toISOString();
  const [items, entries] = await Promise.all([
    supabase
      .from('items')
      .select(ITEM_SELECT)
      .eq('board_id', boardId)
      .is('deleted_at', null)
      .or(`keep_until.is.null,keep_until.gt.${nowIso}`)
      .order('created_at', { ascending: true }),
    getEntries(boardId),
  ]);
  if (items.error) raise(items.error);
  return { items: (items.data ?? []).map(mapItem), entries };
}

/** Items changed since a cursor — INCLUDING deleted/expired ones, so a
 *  catch-up can remove them (the live filter would hide the deletion). */
export async function getItemsSince(boardId: string, since: string): Promise<ItemWithAuthor[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_SELECT)
    .eq('board_id', boardId)
    .gt('updated_at', since)
    .order('created_at', { ascending: true });
  if (error) raise(error);
  return (data ?? []).map(mapItem);
}

export async function getEntries(boardId: string): Promise<ListEntry[]> {
  const { data, error } = await supabase
    .from('list_entries')
    .select('*')
    .eq('board_id', boardId)
    .order('position', { ascending: true });
  if (error) raise(error);
  return (data ?? []).map(mapEntry);
}

export async function getRemovedItems(boardId: string): Promise<ItemWithAuthor[]> {
  const { data, error } = await supabase.rpc('list_removed_items', { p_board_id: boardId });
  if (error) raise(error);
  return (data ?? []).map(mapItem);
}

// ---------------------------------------------------------------------------
// Profile / account
// ---------------------------------------------------------------------------

export async function updateProfile(
  displayName: string,
  avatarPath: string | null = null,
): Promise<User> {
  const { data, error } = await supabase.rpc('update_profile', {
    p_display_name: displayName,
    p_avatar_path: avatarPath ?? undefined,
  });
  if (error) raise(error);
  return mapUser(data as unknown as ProfileRow);
}

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export async function createBoard(
  name: string,
  color: BoardColor,
  timezone: string,
): Promise<Board> {
  const { data, error } = await supabase.rpc('create_board', {
    p_name: name,
    p_color: color,
    p_timezone: timezone,
  });
  if (error) raise(error);
  return mapBoard(data);
}

export async function renameBoard(id: string, name: string, color: BoardColor): Promise<void> {
  const { error } = await supabase.rpc('rename_board', { p_board_id: id, p_name: name, p_color: color });
  if (error) raise(error);
}

export async function deleteBoard(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_board', { p_board_id: id });
  if (error) raise(error);
}

export async function leaveBoard(id: string): Promise<void> {
  const { error } = await supabase.rpc('leave_board', { p_board_id: id });
  if (error) raise(error);
}

export async function removeMember(boardId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_board_id: boardId, p_user_id: userId });
  if (error) raise(error);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type NewItem = {
  id: string;
  boardId: string;
  type: ItemType;
  color: ItemColor;
  body?: string | null;
  title?: string | null;
  eventAt?: string | null;
  place?: string | null;
  photoPath?: string | null;
  pinned?: boolean;
  entries?: { id: string; text: string }[];
};

export async function postItem(input: NewItem): Promise<ItemWithAuthor> {
  // The generated arg types mark nullable columns as non-null strings; cast
  // the payload since the SQL functions accept NULL.
  const { data, error } = await supabase.rpc('post_item', {
    p_id: input.id,
    p_board_id: input.boardId,
    p_type: input.type,
    p_color: input.color,
    p_body: input.body ?? null,
    p_title: input.title ?? null,
    p_event_at: input.eventAt ?? null,
    p_place: input.place ?? null,
    p_photo_path: input.photoPath ?? null,
    p_pinned: input.pinned ?? false,
    p_entries: (input.entries ?? null) as never,
  } as never);
  if (error) raise(error);
  return mapItem(data);
}

export type ItemEdit = {
  body?: string | null;
  title?: string | null;
  eventAt?: string | null;
  place?: string | null;
  color?: ItemColor;
};

/**
 * edit_item overwrites every field, so merge the patch with the item first —
 * otherwise editing just the text would blank the title/place/date and reset
 * the colour.
 */
export async function editItem(current: ItemWithAuthor, patch: ItemEdit): Promise<void> {
  const { error } = await supabase.rpc('edit_item', {
    p_id: current.id,
    p_expected_version: current.version,
    p_body: patch.body !== undefined ? patch.body : current.body,
    p_title: patch.title !== undefined ? patch.title : current.title,
    p_event_at: patch.eventAt !== undefined ? patch.eventAt : current.eventAt,
    p_place: patch.place !== undefined ? patch.place : current.place,
    p_color: patch.color ?? current.color,
  } as never);
  if (error) raise(error);
}

export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_pinned', { p_id: id, p_pinned: pinned });
  if (error) raise(error);
}

export async function setDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_done', { p_id: id, p_done: done });
  if (error) raise(error);
}

export async function setItemPosition(id: string, x: number | null, y: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_item_position', { p_id: id, p_x: x, p_y: y } as never);
  if (error) raise(error);
}

export async function keepLonger(id: string): Promise<void> {
  const { error } = await supabase.rpc('keep_longer', { p_id: id });
  if (error) raise(error);
}

export async function removeItem(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_item', { p_id: id });
  if (error) raise(error);
}

export async function restoreItem(id: string): Promise<void> {
  const { error } = await supabase.rpc('restore_item', { p_id: id });
  if (error) raise(error);
}

// ---------------------------------------------------------------------------
// List entries (ids are client-generated so retries are safe)
// ---------------------------------------------------------------------------

export async function addEntry(id: string, itemId: string, text: string): Promise<ListEntry> {
  const { data, error } = await supabase.rpc('add_entry', { p_id: id, p_item_id: itemId, p_text: text });
  if (error) raise(error);
  return mapEntry(data);
}

export async function setEntryChecked(id: string, checked: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_entry_checked', { p_id: id, p_checked: checked });
  if (error) raise(error);
}

export async function editEntry(id: string, text: string): Promise<void> {
  const { error } = await supabase.rpc('edit_entry', { p_id: id, p_text: text });
  if (error) raise(error);
}

export async function removeEntry(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_entry', { p_id: id });
  if (error) raise(error);
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function getInviteLink(boardId: string): Promise<InviteLink> {
  const { data, error } = await supabase.rpc('get_invite_link', { p_board_id: boardId });
  if (error) raise(error);
  const row = data?.[0];
  if (!row) raise({ message: 'invite_invalid' });
  return { token: row!.token, code: row!.code, expiresAt: row!.expires_at };
}

export async function resetInviteLink(boardId: string): Promise<void> {
  const { error } = await supabase.rpc('reset_invite_link', { p_board_id: boardId });
  if (error) raise(error);
}

export async function previewInvite(tokenOrCode: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('preview_invite', { p_token_or_code: tokenOrCode });
  if (error) raise(error);
  const row = data?.[0];
  if (!row) return null;
  return {
    boardName: row.board_name,
    invitedBy: row.invited_by,
    memberFirstNames: row.member_first_names ?? [],
    memberCount: row.member_count,
  };
}

export async function acceptInvite(
  tokenOrCode: string,
  displayName?: string | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_invite', {
    p_token_or_code: tokenOrCode,
    p_display_name: displayName ?? undefined,
  });
  if (error) raise(error);
  return data ?? null;
}

// ---------------------------------------------------------------------------
// Account lifecycle & linking (docs/plan.md §8 step 4, §5 delete_account)
// ---------------------------------------------------------------------------

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_account');
  if (error) raise(error);
  // Remove the auth user. `functions.invoke` returns { error } rather than
  // throwing, so check it — otherwise we'd sign out and report success while
  // the user (e.g. a linked Apple/Google account) still exists.
  const { error: fnError } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (fnError) raise(fnError as { message?: string });
  await supabase.auth.signOut();
}

export async function linkProvider(provider: 'apple' | 'google'): Promise<void> {
  // In React Native linkIdentity returns the provider URL instead of
  // redirecting; open it in an auth session so the sign-in page appears and
  // the resulting session is captured.
  const redirectTo = Linking.createURL('auth');
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) raise(error);
  if (!data?.url) return;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    const code = new URL(result.url).searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) raise(exchangeError);
    }
  }
}

export async function linkEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) raise(error);
}

// ---------------------------------------------------------------------------
// Storage (signed URLs for private buckets)
// ---------------------------------------------------------------------------

export async function signedPhotoUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from('board-photos').createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function uploadPhoto(boardId: string, itemId: string, fileUri: string): Promise<string> {
  const path = `${boardId}/${itemId}/${Crypto.randomUUID()}.jpg`;
  // Resize + re-encode (strips EXIF) before the bytes leave the device. Read
  // the bytes with expo-file-system — `fetch()` on a local file URI is
  // unreliable on device.
  const preparedUri = await preparePhoto(fileUri);
  const bytes = await new ExpoFile(preparedUri).arrayBuffer();
  const { error } = await supabase.storage
    .from('board-photos')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) raise(error);
  return path;
}
