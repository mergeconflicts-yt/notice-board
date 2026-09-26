// Edge Function: cleanup-users (docs/plan.md §10). Service-role only.
// Deletes inactive anonymous users: memberless after 30 days, board members
// after 90 days (uninstall/device-loss grace; guest sign-out itself deletes
// the account immediately client-side).
//
// Candidate selection runs in SQL (inactive_anonymous_user_ids), joining
// auth.users against board_members so it scales and sees boards joined
// mid-run; activity includes token refreshes, not just last_sign_in_at. Each
// id is re-checked (is_inactive_anonymous_user) immediately before deletion.
import { createClient } from 'jsr:@supabase/supabase-js@2';
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
    // Re-check in the database right before deleting: a board joined or a
    // session refreshed since the candidate query must win.
    const { data: stillIdle, error: checkError } = await admin.rpc(
      'is_inactive_anonymous_user',
      { p_id: id },
    );
    if (checkError || stillIdle !== true) continue;
    const { error: delError } = await admin.auth.admin.deleteUser(id);
    if (!delError) deleted += 1;
  }

  return Response.json({ candidates: ids?.length ?? 0, deleted });
});
