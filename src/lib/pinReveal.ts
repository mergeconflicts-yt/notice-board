/** One-shot reveal request: pinning happens in the note viewer, but the
 *  pinned strip (which must scroll to the fresh pin) lives on the board
 *  screen. The viewer records the pin here on success; the board consumes it
 *  when focused again. In-memory only — a relaunch needs no reveal. */
let pendingId: string | null = null;

export function requestPinReveal(id: string): void {
  pendingId = id;
}

export function consumePinReveal(): string | null {
  const id = pendingId;
  pendingId = null;
  return id;
}
