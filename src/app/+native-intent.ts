import { getSharedPayloads } from 'expo-sharing';

/**
 * Routes incoming OS shares (WhatsApp → Fridge Board) to the Post-to screen.
 * The share extension/intent launches the app with an `expo-sharing` URL;
 * everything else falls through to normal routing.
 */
export async function redirectSystemPath({ path }: { path: string }): Promise<string> {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      // Touch the payloads so the handler screen sees them immediately.
      getSharedPayloads();
      return '/share';
    }
    return path;
  } catch {
    return '/';
  }
}
