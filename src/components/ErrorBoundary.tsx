import { Component, ReactNode } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors, fonts } from '../theme';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render/lifecycle errors in its subtree and shows them on screen
 * instead of letting the app drop to a blank/closed state. Logs to Metro too.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[error-boundary]', error?.message, error?.stack, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.message}>{String(error.message || error)}</Text>
          <Text style={styles.stack}>{error.stack}</Text>
        </ScrollView>
        <Pressable style={styles.dismiss} onPress={() => this.setState({ error: null })}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 40,
  },
  title: { fontFamily: fonts.ui.extraBold, fontSize: 22, color: colors.danger, marginBottom: 10 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  message: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.ink, marginBottom: 10 },
  stack: { fontFamily: fonts.ui.regular, fontSize: 12, color: colors.inkSoft },
  dismiss: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  dismissText: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.background },
});
