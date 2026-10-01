// Edge Function: cleanup-users (docs/plan.md §10). Service-role only.
// Deletes inactive anonymous users: memberless after 30 days, board members
// after 90 days (uninstall/device-loss grace; guest sign-out itself deletes
// the account immediately client-side).
//
// Candidate selection runs in SQL (inactive_anonymous_user_ids), joining
// auth.users against board_members so it scales and sees boards joined
// mid-run; activity includes token refreshes, not just last_sign_in_at. Each
// id is handed to cleanup_anonymous_user, which re-checks inactivity and
// tidies the target's boards (soft-delete memberless boards, promote a
// surviving owner, clear the avatar) before the auth user is deleted — so a
// board can never be orphaned without members.
import { createClient } from 'jsr:@supabase/supabase-js@2.116.0';
import { authorized } from '../_shared/auth.ts';

const MAX_PER_RUN = 500;

Deno.serve(async (req: Request) => {
  if (!authorized(req)) return new Response('forbidden', { status: 403 });

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const { data: ids, error } = await admin.rpc('inactive_anonymous_user_ids', {
    p_limit: MAX_PER_RUN,
  });
  if (error) return new Response(error.message, { status: 500 });

  let deleted = 0;
  for (const id of ids ?? []) {
    // Tidy board state and re-check inactivity in one atomic step; false
    // means a board was joined or a session refreshed since the candidate
    // query, so the account must be left alone.
    const { data: cleaned, error: cleanupError } = await admin.rpc(
      'cleanup_anonymous_user',
      { p_id: id },
    );
    if (cleanupError || cleaned !== true) continue;
    const { error: delError } = await admin.auth.admin.deleteUser(id);
    if (!delError) deleted += 1;
  }

  return Response.json({ candidates: ids?.length ?? 0, deleted });
});
