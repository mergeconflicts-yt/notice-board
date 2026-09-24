import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../theme';

type Props = {
  siteKey: string;
  onToken: (token: string) => void;
  onError?: (message: string) => void;
};

/**
 * Cloudflare Turnstile in a tiny WebView (docs/plan.md §8 step 5). Production
 * only — when no site key is configured the app signs in without a captcha.
 */
export function Turnstile({ siteKey, onToken, onError }: Props) {
  const html = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;background:${colors.background};display:flex;align-items:center;justify-content:center;height:100%}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback" async defer></script>
</head><body>
<div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="onToken" data-error-callback="onError"></div>
<script>
  function onToken(token) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token })); }
  function onError(code) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code })); }
</script>
</body></html>`,
    [siteKey],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; token?: string; code?: string };
      if (data.type === 'token' && data.token) onToken(data.token);
      else if (data.type === 'error') onError?.(data.code ?? 'captcha failed');
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={styles.wrap}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        onMessage={handleMessage}
        javaScriptEnabled
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 320, height: 90, alignSelf: 'center' },
  web: { backgroundColor: 'transparent' },
});
