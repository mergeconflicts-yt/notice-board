import { create } from 'zustand';

export type ToastAction = { label: string; onPress: () => void };

type ToastState = {
  message: string | null;
  action: ToastAction | null;
  /** How long the toast stays up before it dismisses itself (ms). */
  duration: number;
  /** Bumped on every show so the host restarts its timers and animation. */
  key: number;
  show: (message: string, action?: ToastAction, duration?: number) => void;
  hide: () => void;
};

export const useToast = create<ToastState>((set) => ({
  message: null,
  action: null,
  duration: 5000,
  key: 0,
  show: (message, action, duration = 5000) =>
    set((s) => ({ message, action: action ?? null, duration, key: s.key + 1 })),
  hide: () => set({ message: null, action: null }),
}));
