import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { Button } from './Button';
import { Turnstile } from './Turnstile';
import { turnstileSiteKey } from '../lib/supabase';
import { isIdentityConflict } from '../lib/api';
import {
  EMAIL_CODE_LENGTH,
  EMAIL_RESEND_SECONDS,
  isCodeComplete,
  isEmailValid,
  mapOtpError,
  normalizeEmail,
} from '../utils/emailCode';

type Props = {
  /** 'signup' sends + verifies a sign-in code; 'link' confirms an email change. */
  mode: 'signup' | 'link';
  onSend: (email: string, captchaToken?: string) => Promise<void>;
  onVerify: (email: string, code: string) => Promise<void>;
  onDone: () => void;
  /** Shown when the identity belongs to another account; suppresses the
   *  inline error so the caller can offer "sign in instead". */
  onConflict?: () => void;
  /** Back arrow. On the code step it returns to the email step. */
  onBack?: () => void;
};

const emptyDigits = (): string[] => Array(EMAIL_CODE_LENGTH).fill('');

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Email → 6-digit code → verify, shared by Welcome sign-in/up and Profile save. */
export function EmailCode({ mode, onSend, onVerify, onDone, onConflict, onBack }: Props) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const [digits, setDigits] = useState<string[]>(emptyDigits);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<(TextInput | null)[]>([]);
  const submitting = useRef(false);

  const captchaNeeded = Boolean(turnstileSiteKey) && !captchaToken;
  const activeIndex = digits.findIndex((d) => !d);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    const address = normalizeEmail(email);
    if (!isEmailValid(address) || captchaNeeded || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(address, captchaToken ?? undefined);
      setEmail(address);
      setDigits(emptyDigits());
      setCooldown(EMAIL_RESEND_SECONDS);
      setCaptchaToken(null);
      setCaptchaNonce((n) => n + 1);
      setStep('code');
    } catch (e) {
      // The link flow learns about an existing identity when it requests the
      // change, not when the code is verified.
      if (onConflict && isIdentityConflict(e)) onConflict();
      else setError(mapOtpError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (joined: string) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await onVerify(email, joined);
      onDone();
    } catch (e) {
      if (onConflict && isIdentityConflict(e)) {
        onConflict();
      } else {
        setError(mapOtpError(e));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '');
    const next = [...digits];
    let focusIndex = i;
    if (clean.length > 1) {
      for (let k = 0; k < clean.length && i + k < EMAIL_CODE_LENGTH; k++) {
        next[i + k] = clean[k];
      }
      focusIndex = Math.min(i + clean.length, EMAIL_CODE_LENGTH - 1);
    } else {
      next[i] = clean.slice(-1);
      if (clean && i < EMAIL_CODE_LENGTH - 1) focusIndex = i + 1;
    }
    setDigits(next);
    if (clean) refs.current[focusIndex]?.focus();
    // Signs you in on its own once all six are in.
    if (isCodeComplete(next)) void submitCode(next.join(''));
  };

  const back = () => {
    if (step === 'code') {
      setStep('email');
      setDigits(emptyDigits());
      setError(null);
      return;
    }
    onBack?.();
  };

  if (step === 'email') {
    return (
      <View>
        {onBack ? (
          <Pressable onPress={back} hitSlop={10} style={styles.back}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
          </Pressable>
        ) : null}
        <Text style={styles.title}>What’s your email?</Text>
        <Text style={styles.subtitle}>
          {mode === 'link'
            ? 'We’ll send a 6-digit code to confirm this email.'
            : 'We’ll send a 6-digit code. New here? This creates your account.'}
        </Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          placeholder="you@example.com"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        {turnstileSiteKey ? (
          <View style={styles.captcha}>
            <Turnstile
              key={captchaNonce}
              siteKey={turnstileSiteKey}
              onToken={setCaptchaToken}
              onError={() => setCaptchaToken(null)}
            />
          </View>
        ) : null}
        <Button
          label={busy ? 'Sending…' : 'Send code'}
          variant="accent"
          onPress={() => void send()}
          disabled={!isEmailValid(normalizeEmail(email)) || busy || captchaNeeded}
          style={styles.send}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View>
      {onBack ? (
        <Pressable onPress={back} hitSlop={10} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.ink} />
        </Pressable>
      ) : null}
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>Enter the code we sent to {email}</Text>
      <View style={styles.boxes}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            style={[styles.box, i === activeIndex && styles.boxActive]}
            value={d}
            onChangeText={(v) => setDigit(i, v)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
              }
            }}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            maxLength={EMAIL_CODE_LENGTH}
            autoCorrect={false}
            selectTextOnFocus
          />
        ))}
      </View>

      {cooldown > 0 ? (
        <Text style={styles.resend}>Resend code in {mmss(cooldown)}</Text>
      ) : (
        <Pressable onPress={() => void send()} hitSlop={8} disabled={busy || captchaNeeded}>
          <Text style={styles.resendLink}>Resend code</Text>
        </Pressable>
      )}
      {turnstileSiteKey && !captchaToken && cooldown <= 0 ? (
        <View style={styles.captcha}>
          <Turnstile
            key={`resend-${captchaNonce}`}
            siteKey={turnstileSiteKey}
            onToken={setCaptchaToken}
            onError={() => setCaptchaToken(null)}
          />
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          setStep('email');
          setDigits(emptyDigits());
          setError(null);
        }}
        hitSlop={8}
      >
        <Text style={styles.different}>Use a different email</Text>
      </Pressable>
      <Text style={styles.helper}>Signs you in on its own when all six are in.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginBottom: 12, alignSelf: 'flex-start' },
  title: { fontFamily: fonts.hand.bold, fontSize: 34, lineHeight: 36, color: colors.ink },
  subtitle: {
    fontFamily: fonts.ui.regular,
    fontSize: 15,
    color: colors.inkSoft,
    marginTop: 8,
    marginBottom: 18,
  },
  captcha: { marginTop: 12, alignItems: 'center' },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  send: { marginTop: 16 },
  error: { fontFamily: fonts.ui.regular, color: colors.danger, fontSize: 13, marginTop: 12 },
  boxes: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 4 },
  box: {
    flex: 1,
    height: 60,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: fonts.hand.bold,
    fontSize: 26,
    color: colors.ink,
  },
  boxActive: { borderColor: colors.accent, borderWidth: 2 },
  resend: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 16,
  },
  resendLink: {
    fontFamily: fonts.ui.bold,
    fontSize: 14,
    color: colors.accentDeep,
    textAlign: 'center',
    marginTop: 16,
  },
  different: {
    fontFamily: fonts.ui.semibold,
    fontSize: 14,
    color: colors.ink,
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 14,
  },
  helper: {
    fontFamily: fonts.ui.regular,
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 22,
  },
});
