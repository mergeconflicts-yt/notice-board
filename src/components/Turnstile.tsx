import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../theme';
import { INVITE_BASE_URL } from '../lib/inviteLinks';

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
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head><body>
<div class="cf-turnstile" data-sitekey="${siteKey}" data-callback="onToken" data-error-callback="onError" data-expired-callback="onExpired"></div>
<script>
  function onToken(token) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token })); }
  function onError(code) { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', code })); }
  function onExpired() { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'expired' })); }
</script>
</body></html>`,
    [siteKey],
  );

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type: string; token?: string; code?: string };
      if (data.type === 'token' && data.token) onToken(data.token);
      else if (data.type === 'expired') onError?.('captcha expired');
      else if (data.type === 'error') onError?.(data.code ?? 'captcha failed');
    } catch {
      // ignore non-JSON messages
    }
  };

  return (
    <View style={styles.wrap}>
      <WebView
        // Only Cloudflare (the challenge script) and the app's real origin may
        // load. In production the base URL is required — Turnstile validates the
        // page domain, so there is no localhost fallback.
        originWhitelist={INVITE_BASE_URL ? ['https://challenges.cloudflare.com', INVITE_BASE_URL] : ['https://challenges.cloudflare.com']}
        source={{ html, baseUrl: INVITE_BASE_URL }}
        onMessage={handleMessage}
        onError={() => onError?.('captcha failed to load')}
        onHttpError={() => onError?.('captcha failed to load')}
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
