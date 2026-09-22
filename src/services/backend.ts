import {
  Board,
  MemberWithUser,
  NewNote,
  Note,
  NotePatch,
  NoteWithAuthor,
  User,
} from '../types';

export type Unsubscribe = () => void;

export interface NoticeBackend {
  readonly mode: 'supabase' | 'local';

  /** Restore or establish a session. Returns the existing profile, or null if
   *  the device has never set up an identity yet. */
  init(): Promise<User | null>;

  /** Create (or update) the current user's profile and return it. */
  ensureUser(displayName: string, avatar?: string | null): Promise<User>;

  getUser(id: string): Promise<User | null>;

  createBoard(name: string): Promise<Board>;
  joinBoard(inviteCode: string): Promise<Board>;
  getBoard(id: string): Promise<Board | null>;
  /** Boards the current user has joined, newest first. */
  getBoards(): Promise<Board[]>;
  updateBoard(id: string, patch: { name?: string }): Promise<void>;
  leaveBoard(id: string): Promise<void>;
  deleteBoard(id: string): Promise<void>;

  getMembers(boardId: string): Promise<MemberWithUser[]>;

  getNotes(boardId: string): Promise<NoteWithAuthor[]>;
  /** Persist an image and return a URL/path that can be stored on a note. */
  uploadImage(uri: string): Promise<string>;
  addNote(note: NewNote): Promise<Note>;
  updateNote(id: string, patch: NotePatch): Promise<void>;
  deleteNote(id: string): Promise<void>;

  onNotesChanged(boardId: string, cb: (notes: NoteWithAuthor[]) => void): Unsubscribe;
  onMembersChanged(boardId: string, cb: (members: MemberWithUser[]) => void): Unsubscribe;
  onBoardChanged(boardId: string, cb: (board: Board | null) => void): Unsubscribe;
}
