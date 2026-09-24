import { NoticeBackend } from './backend';
import { NoticeBackendV2 } from './backendV2';
import { isSupabaseConfigured, SupabaseBackend } from './supabase';
import { SupabaseBackendV2 } from './supabaseV2';
import { LocalBackend } from './local';
import { LocalBackendV2 } from './localV2';

let instance: NoticeBackend | null = null;

export function getBackend(): NoticeBackend {
  if (!instance) {
    instance = isSupabaseConfigured() ? new SupabaseBackend() : new LocalBackend();
  }
  return instance;
}

let instanceV2: NoticeBackendV2 | null = null;

/**
 * Backend v2 (board_items / list_entries / item_assets + invites/events).
 * Uses Supabase when configured, otherwise the on-device demo backend.
 */
export function getBackendV2(): NoticeBackendV2 {
  if (!instanceV2) {
    instanceV2 = isSupabaseConfigured() ? new SupabaseBackendV2() : new LocalBackendV2();
  }
  return instanceV2;
}

export type { NoticeBackend, Unsubscribe } from './backend';
export type { NoticeBackendV2 } from './backendV2';
export { VersionConflictError } from './backendV2';
export { isSupabaseConfigured } from './supabase';
