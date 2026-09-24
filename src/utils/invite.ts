/**
 * Pull the actual invite out of whatever the user pasted — a bare token/code,
 * a `https://…/j/<token>` (or `noticeboard://j/<token>`) link, or the whole
 * share message. Tokens are case-sensitive and may contain `-`/`_`, so the
 * result is returned verbatim and never normalized here; the server hashes
 * the raw value for the token and a normalized copy for the code.
 */
export function parseInviteInput(input: string): string {
  const text = input.trim();
  if (!text) return '';

  const link = text.match(/\/j\/([A-Za-z0-9_-]+)/);
  if (link) return link[1];

  const labelled = text.match(/code\s*[:\-]?\s*([A-Za-z0-9_-]{6,})/i);
  if (labelled) return labelled[1];

  // A pasted sentence with a trailing token/code word (e.g. "… Board: XXXX").
  if (/\s/.test(text)) {
    const trailing = text.match(/([A-Za-z0-9_-]{8,24})\s*$/);
    if (trailing) return trailing[1];
  }

  return text;
}
