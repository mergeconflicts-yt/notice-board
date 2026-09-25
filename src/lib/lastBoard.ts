import AsyncStorage from '@react-native-async-storage/async-storage';

/** The last board the user opened, so a returning launch can go straight back
 *  into it instead of the board list. Cleared on sign-out. */
const KEY = 'notice.lastBoardId';

export async function rememberBoard(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    // Best effort — losing this only costs a tap next launch.
  }
}

export async function recallBoard(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function forgetBoard(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
