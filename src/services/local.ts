import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Board,
  BoardMember,
  MemberWithUser,
  NewNote,
  Note,
  NotePatch,
  NoteWithAuthor,
  User,
} from '../types';
import { generateInviteCode, randomId } from '../utils/id';
import { NoticeBackend, Unsubscribe } from './backend';

const STORAGE_KEY = 'noticeboard.local.v1';

type LocalDB = {
  currentUserId: string | null;
  users: Record<string, User>;
  boards: Record<string, Board>;
  members: Record<string, Record<string, BoardMember>>;
  notes: Record<string, Note>;
};

function emptyDB(): LocalDB {
  return {
    currentUserId: null,
    users: {},
    boards: {},
    members: {},
    notes: {},
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

export class LocalBackend implements NoticeBackend {
  readonly mode = 'local' as const;
  private emitter = new Emitter();
  private db: LocalDB = emptyDB();
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

  async init(): Promise<User | null> {
    await this.load();
    if (!this.db.currentUserId) return null;
    return this.db.users[this.db.currentUserId] ?? null;
  }

  async ensureUser(displayName: string, avatar?: string | null): Promise<User> {
    await this.load();
    const existing = this.db.currentUserId ? this.db.users[this.db.currentUserId] : undefined;
    if (existing) {
      const updated: User = { ...existing, displayName, avatar: avatar ?? existing.avatar };
      this.db.users[updated.id] = updated;
      await this.save();
      return updated;
    }
    const id = randomId();
    const created: User = {
      id,
      displayName,
      avatar: avatar ?? null,
      createdAt: new Date().toISOString(),
    };
    this.db.users[id] = created;
    this.db.currentUserId = id;
    await this.save();
    return created;
  }

  async getUser(id: string): Promise<User | null> {
    await this.load();
    return this.db.users[id] ?? null;
  }

  async createBoard(name: string): Promise<Board> {
    await this.load();
    const user = this.requireUser();
    let inviteCode = generateInviteCode();
    while (Object.values(this.db.boards).some((b) => b.inviteCode === inviteCode)) {
      inviteCode = generateInviteCode();
    }
    const board: Board = {
      id: randomId(),
      name,
      ownerId: user.id,
      inviteCode,
      createdAt: new Date().toISOString(),
    };
    this.db.boards[board.id] = board;
    this.db.members[board.id] = {
      [user.id]: { boardId: board.id, userId: user.id, joinedAt: new Date().toISOString() },
    };
    await this.save();
    return board;
  }

  async joinBoard(inviteCode: string): Promise<Board> {
    await this.load();
    const user = this.requireUser();
    const board = Object.values(this.db.boards).find(
      (b) => b.inviteCode.toUpperCase() === inviteCode.toUpperCase(),
    );
    if (!board) throw new Error('No board with that code');
    if (!this.db.members[board.id]) this.db.members[board.id] = {};
    this.db.members[board.id][user.id] = {
      boardId: board.id,
      userId: user.id,
      joinedAt: new Date().toISOString(),
    };
    await this.save();
    this.emitMembers(board.id);
    return board;
  }

  async getBoard(id: string): Promise<Board | null> {
    await this.load();
    return this.db.boards[id] ?? null;
  }

  async getBoards(): Promise<Board[]> {
    await this.load();
    const userId = this.db.currentUserId;
    if (!userId) return [];
    return Object.values(this.db.boards)
      .filter((b) => this.db.members[b.id]?.[userId])
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateBoard(id: string, patch: { name?: string }): Promise<void> {
    await this.load();
    const board = this.db.boards[id];
    if (!board) return;
    this.db.boards[id] = { ...board, name: patch.name ?? board.name };
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

  async deleteBoard(id: string): Promise<void> {
    await this.load();
    delete this.db.boards[id];
    delete this.db.members[id];
    for (const noteId of Object.keys(this.db.notes)) {
      if (this.db.notes[noteId].boardId === id) delete this.db.notes[noteId];
    }
    await this.save();
  }

  async getMembers(boardId: string): Promise<MemberWithUser[]> {
    await this.load();
    const map = this.db.members[boardId] ?? {};
    return Object.values(map)
      .map((m) => ({ ...m, user: this.db.users[m.userId] }))
      .filter((m): m is MemberWithUser => Boolean(m.user))
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
  }

  async uploadImage(uri: string): Promise<string> {
    return uri;
  }

  async getNotes(boardId: string): Promise<NoteWithAuthor[]> {
    await this.load();
    return Object.values(this.db.notes)
      .filter((n) => n.boardId === boardId)
      .map((n) => ({
        ...n,
        // Normalize the retired 'grocery' kind to 'list' on read.
        kind: ((n.kind as string) === 'grocery' ? 'list' : n.kind) as Note['kind'],
        // authorId is null once the author's account is gone.
        author: n.authorId ? (this.db.users[n.authorId] ?? null) : null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async addNote(note: NewNote): Promise<Note> {
    await this.load();
    const id = randomId();
    const now = new Date().toISOString();
    const full: Note = { ...note, id, createdAt: now, updatedAt: now };
    this.db.notes[id] = full;
    await this.save();
    this.emitNotes(note.boardId);
    return full;
  }

  async updateNote(id: string, patch: NotePatch): Promise<void> {
    await this.load();
    const note = this.db.notes[id];
    if (!note) return;
    this.db.notes[id] = {
      ...note,
      ...patch,
      id: note.id,
      boardId: note.boardId,
      updatedAt: new Date().toISOString(),
    };
    await this.save();
    this.emitNotes(note.boardId);
  }

  async deleteNote(id: string): Promise<void> {
    await this.load();
    const note = this.db.notes[id];
    if (!note) return;
    delete this.db.notes[id];
    await this.save();
    this.emitNotes(note.boardId);
  }

  onNotesChanged(boardId: string, cb: (notes: NoteWithAuthor[]) => void): Unsubscribe {
    return this.emitter.on(`notes:${boardId}`, () => {
      this.getNotes(boardId).then(cb);
    });
  }

  onMembersChanged(boardId: string, cb: (members: MemberWithUser[]) => void): Unsubscribe {
    return this.emitter.on(`members:${boardId}`, () => {
      this.getMembers(boardId).then(cb);
    });
  }

  onBoardChanged(boardId: string, cb: (board: Board | null) => void): Unsubscribe {
    return this.emitter.on(`board:${boardId}`, () => {
      this.getBoard(boardId).then(cb);
    });
  }

  private emitNotes(boardId: string): void {
    this.emitter.emit(`notes:${boardId}`, null);
  }

  private emitMembers(boardId: string): void {
    this.emitter.emit(`members:${boardId}`, null);
  }

  private emitBoard(boardId: string): void {
    this.emitter.emit(`board:${boardId}`, null);
  }

  private requireUser(): User {
    if (!this.db.currentUserId) throw new Error('No signed-in user');
    const user = this.db.users[this.db.currentUserId];
    if (!user) throw new Error('No signed-in user');
    return user;
  }
}
