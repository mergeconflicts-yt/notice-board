import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Board,
  MemberWithUser,
  NewNote,
  Note,
  NotePatch,
  NoteWithAuthor,
  User,
} from '../types';
import { NoticeBackend, Unsubscribe } from './backend';
import { generateInviteCode } from '../utils/id';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

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
};
type MemberRow = {
  board_id: string;
  user_id: string;
  joined_at: string;
  profiles: ProfileRow | ProfileRow[] | null;
};
type NoteRow = {
  id: string;
  board_id: string;
  author_id: string;
  text: string;
  image_url: string | null;
  color: string;
  rotation: number;
  position_x: number;
  position_y: number;
  kind: string;
  data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  completed_at: string | null;
  profiles: ProfileRow | ProfileRow[] | null;
};

function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

function mapBoard(row: BoardRow): Board {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    createdAt: row.created_at,
  };
}

function pickProfile(profiles: ProfileRow | ProfileRow[] | null): User | null {
  if (!profiles) return null;
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return p ? mapProfile(p) : null;
}

function mapNote(row: NoteRow): NoteWithAuthor {
  const rawKind = row.kind as string;
  const kind: Note['kind'] =
    rawKind === 'list' || rawKind === 'grocery'
      ? 'list'
      : rawKind === 'appointment' || rawKind === 'photo'
        ? rawKind
        : 'note';
  return {
    id: row.id,
    boardId: row.board_id,
    authorId: row.author_id,
    text: row.text,
    imageUrl: row.image_url,
    color: (row.color as Note['color']) || 'yellow',
    rotation: row.rotation ?? 0,
    positionX: row.position_x ?? 0.5,
    positionY: row.position_y ?? 0.5,
    kind,
    data: row.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    author: pickProfile(row.profiles),
  };
}

export class SupabaseBackend implements NoticeBackend {
  readonly mode = 'supabase' as const;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(url!, anonKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  async init(): Promise<User | null> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) {
      const { data: signIn, error } = await this.client.auth.signInAnonymously();
      if (error) throw error;
      if (!signIn.user) return null;
    }
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return null;
    const { data: rows } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    return rows ? mapProfile(rows as ProfileRow) : null;
  }

  async ensureUser(displayName: string, avatar?: string | null): Promise<User> {
    let {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) {
      // No session (fresh install, cleared storage, or a refresh that fell
      // over) — establish an anonymous one instead of failing the signup.
      const { data: signIn, error: signInError } = await this.client.auth.signInAnonymously();
      if (signInError) throw signInError;
      user = signIn.user;
    }
    if (!user) throw new Error('Could not start a session. Check your connection and try again.');
    const { data, error } = await this.client
      .from('profiles')
      .upsert(
        { id: user.id, display_name: displayName, avatar: avatar ?? null },
        { onConflict: 'id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapProfile(data as ProfileRow);
  }

  async getUser(id: string): Promise<User | null> {
    const { data } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return data ? mapProfile(data as ProfileRow) : null;
  }

  async createBoard(name: string): Promise<Board> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await this.client
      .from('boards')
      .insert({ name, owner_id: user.id, invite_code: generateInviteCode() })
      .select('*')
      .single();
    if (error) throw error;
    const board = mapBoard(data as BoardRow);
    await this.client
      .from('board_members')
      .insert({ board_id: board.id, user_id: user.id });
    return board;
  }

  async joinBoard(inviteCode: string): Promise<Board> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { data, error } = await this.client
      .from('boards')
      .select('*')
      .ilike('invite_code', inviteCode.trim().toUpperCase())
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No board with that code');
    await this.client
      .from('board_members')
      .upsert({ board_id: data.id, user_id: user.id }, { onConflict: 'board_id,user_id' });
    return mapBoard(data as BoardRow);
  }

  async getBoard(id: string): Promise<Board | null> {
    const { data } = await this.client.from('boards').select('*').eq('id', id).maybeSingle();
    return data ? mapBoard(data as BoardRow) : null;
  }

  async getBoards(): Promise<Board[]> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return [];
    const { data, error } = await this.client
      .from('board_members')
      .select('joined_at, boards(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    if (error) throw error;
    return (
      data as { joined_at: string; boards: BoardRow | BoardRow[] | null }[] | null
    )?.flatMap((row) => {
      const b = Array.isArray(row.boards) ? row.boards[0] : row.boards;
      return b ? [mapBoard(b)] : [];
    }) ?? [];
  }

  async updateBoard(id: string, patch: { name?: string }): Promise<void> {
    await this.client.from('boards').update({ name: patch.name }).eq('id', id);
  }

  async leaveBoard(id: string): Promise<void> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return;
    await this.client
      .from('board_members')
      .delete()
      .eq('board_id', id)
      .eq('user_id', user.id);
  }

  async deleteBoard(id: string): Promise<void> {
    await this.client.from('boards').delete().eq('id', id);
  }

  async getMembers(boardId: string): Promise<MemberWithUser[]> {
    const { data, error } = await this.client
      .from('board_members')
      .select('*, profiles(*)')
      .eq('board_id', boardId)
      .order('joined_at', { ascending: true });
    if (error) throw error;
    return (data as MemberRow[]).map((row) => ({
      boardId: row.board_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      user: pickProfile(row.profiles)!,
    }));
  }

  async getNotes(boardId: string): Promise<NoteWithAuthor[]> {
    const { data, error } = await this.client
      .from('notes')
      .select('*, profiles(*)')
      .eq('board_id', boardId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as NoteRow[]).map(mapNote);
  }

  async uploadImage(uri: string): Promise<string> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    const ext = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const name = `${user?.id ?? 'anon'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const form = new FormData();
    form.append('file', {
      uri,
      name,
      type: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
    } as unknown as Blob);

    try {
      const { error } = await this.client.storage.from('notes').upload(name, form, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data } = this.client.storage.from('notes').getPublicUrl(name);
      return data.publicUrl;
    } catch {
      return uri;
    }
  }

  async addNote(note: NewNote): Promise<Note> {
    const { data, error } = await this.client
      .from('notes')
      .insert({
        board_id: note.boardId,
        author_id: note.authorId,
        text: note.text,
        image_url: note.imageUrl,
        color: note.color,
        rotation: note.rotation,
        position_x: note.positionX,
        position_y: note.positionY,
        kind: note.kind,
        data: note.data,
        expires_at: note.expiresAt,
      })
      .select('*, profiles(*)')
      .single();
    if (error) throw error;
    return mapNote(data as NoteRow);
  }

  async updateNote(id: string, patch: NotePatch): Promise<void> {
    await this.client
      .from('notes')
      .update({
        text: patch.text,
        image_url: patch.imageUrl,
        color: patch.color,
        rotation: patch.rotation,
        position_x: patch.positionX,
        position_y: patch.positionY,
        kind: patch.kind,
        data: patch.data,
        expires_at: patch.expiresAt,
        completed_at: patch.completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  async deleteNote(id: string): Promise<void> {
    await this.client.from('notes').delete().eq('id', id);
  }

  onNotesChanged(boardId: string, cb: (notes: NoteWithAuthor[]) => void): Unsubscribe {
    const channel = this.client
      .channel(`notes-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `board_id=eq.${boardId}` },
        () => {
          this.getNotes(boardId).then(cb).catch(() => {});
        },
      )
      .subscribe();
    return () => this.client.removeChannel(channel);
  }

  onMembersChanged(boardId: string, cb: (members: MemberWithUser[]) => void): Unsubscribe {
    const channel = this.client
      .channel(`members-${boardId}`)
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

  onBoardChanged(boardId: string, cb: (board: Board | null) => void): Unsubscribe {
    const channel = this.client
      .channel(`board-${boardId}`)
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
}
