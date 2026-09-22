import { NoticeBackend } from './backend';
import { isSupabaseConfigured, SupabaseBackend } from './supabase';
import { LocalBackend } from './local';

let instance: NoticeBackend | null = null;

export function getBackend(): NoticeBackend {
  if (!instance) {
    instance = isSupabaseConfigured() ? new SupabaseBackend() : new LocalBackend();
  }
  return instance;
}

export type { NoticeBackend, Unsubscribe } from './backend';
export { isSupabaseConfigured } from './supabase';
