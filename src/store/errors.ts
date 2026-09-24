import { create } from 'zustand';

type ErrorState = {
  message: string | null;
  stack: string | null;
  report: (message: string, stack?: string | null) => void;
  clear: () => void;
};

/** Last captured global JS error, shown by <ErrorOverlay />. */
export const useErrorStore = create<ErrorState>((set) => ({
  message: null,
  stack: null,
  report: (message, stack) => set({ message, stack: stack ?? null }),
  clear: () => set({ message: null, stack: null }),
}));
