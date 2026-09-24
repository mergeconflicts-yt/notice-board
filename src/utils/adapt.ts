import { BoardItemWithAuthor, ListEntry, NoteWithAuthor } from '../types';

/**
 * Rebuild a board-style note from a v2 item. Lists are rehydrated from their
 * entries (title + marked lines), photos resolve to a signed URL, and the
 * paper/layout map back onto color/rotation/position so the existing layout,
 * estimation and rendering keep working untouched.
 */
export function adaptItemToNote(
  item: BoardItemWithAuthor,
  entries: ListEntry[],
  imageUrl: string | null,
): NoteWithAuthor {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const isList = item.type === 'list';
  const text = isList
    ? [
        ...(item.body ? [item.body] : []),
        ...sorted.map((e) => `${e.isChecked ? '☑' : '☐'} ${e.text}`),
      ].join('\n')
    : (item.body ?? '');

  const data: Record<string, unknown> = {};
  if (item.layout?.manual) data.manual = true;
  if (item.eventAt) data.eventAt = item.eventAt;
  if (item.completedBy) data.completedBy = item.completedBy;
  if (isList) {
    data.items = sorted.map((e) => ({ text: e.text, done: e.isChecked }));
  }

  return {
    id: item.id,
    boardId: item.boardId,
    authorId: item.createdBy,
    text,
    imageUrl,
    color: item.paper.color,
    rotation: item.paper.rotation,
    positionX: item.layout?.x ?? 0.5,
    positionY: item.layout?.y ?? 0.5,
    kind: item.type === 'date' ? 'appointment' : item.type,
    data: Object.keys(data).length > 0 ? data : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt ?? item.createdAt,
    expiresAt: item.expiresAt,
    completedAt: item.completedAt,
    author: item.author,
  };
}
