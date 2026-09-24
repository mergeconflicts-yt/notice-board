import { NoticeBackend } from './backend';
import { NoticeBackendV2 } from './backendV2';
import { isSupabaseConfigured, SupabaseBackend } from './supabase';
import { SupabaseBackendV2 } from './supabaseV2';
import { LocalBackend } from './local';

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
 * Supabase-only for now; throws in local demo mode. The v1 backend stays
 * live until the app is ported.
 */
export function getBackendV2(): NoticeBackendV2 {
  if (!isSupabaseConfigured()) {
    throw new Error('Backend v2 requires Supabase configuration (local stack or hosted).');
  }
  if (!instanceV2) instanceV2 = new SupabaseBackendV2();
  return instanceV2;
}

export type { NoticeBackend, Unsubscribe } from './backend';
export type { NoticeBackendV2 } from './backendV2';
export { VersionConflictError } from './backendV2';
export { isSupabaseConfigured } from './supabase';
