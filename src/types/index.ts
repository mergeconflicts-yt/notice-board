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
