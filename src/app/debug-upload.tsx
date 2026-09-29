// TEMPORARY debug route — downloads a real portrait photo, runs the REAL
// preparePhoto on it (iOS JPEG encoder, like the real flow), uploads via the
// REAL uploadPhoto, prints the stored path. Deleted before merging; do not
// ship.
import { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { File } from 'expo-file-system';
import { Paths } from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { uploadPhoto } from '../lib/api';

export default function DebugUpload() {
  const [lines, setLines] = useState<string[]>(['starting…']);

  useEffect(() => {
    let cancelled = false;
    const say = (s: string) => {
      // eslint-disable-next-line no-console
      console.log('[debug-upload]', s);
      if (!cancelled) setLines((prev) => [...prev, s]);
    };
    (async () => {
      try {
        // Real photographic portrait (1200x1800), downloaded on-device so the
        // bytes that follow go through the iOS image pipeline like a camera
        // photo would.
        const srcFile = await File.downloadFileAsync(
          'https://picsum.photos/seed/fridgeboard/1200/1800',
          new File(Paths.cache, 'dbg-src.jpg'),
          { idempotent: true },
        );
        say('downloaded ' + srcFile.uri.slice(-40));
        const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr || !anon.session) {
          say('anon FAIL');
          return;
        }
        say('anon ok');
        const { data: board, error: boardErr } = await supabase.rpc('create_board', {
          p_name: 'dbg',
          p_color: 'mint',
          p_timezone: 'UTC',
        });
        if (boardErr || !board) {
          say('board FAIL');
          return;
        }
        const itemId = 'c0000000-0000-0000-0000-0000000000d2';
        const path = await uploadPhoto((board as { id: string }).id, itemId, srcFile.uri);
        say('PATH=' + path);
        say('done');
      } catch (e) {
        say('FATAL ' + ((e as Error)?.message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {lines.map((l, i) => (
        <Text key={i} style={styles.line}>
          {l}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingTop: 80, backgroundColor: '#fff', flexGrow: 1 },
  line: { fontSize: 15, marginBottom: 10, color: '#111' },
});
