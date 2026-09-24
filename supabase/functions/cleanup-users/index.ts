// Edge Function: cleanup-users (docs/plan.md §10). Service-role only.
// Deletes anonymous users with no board memberships and no sign-in for 30 days.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const IDLE_DAYS = 30;
const PER_PAGE = 200;

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!auth.endsWith(serviceKey)) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const idleCutoff = Date.now() - IDLE_DAYS * 864e5;

  // Collect first, delete afterwards: deleting while paging shifts later users
  // into pages already read, so they'd be skipped.
  const candidates: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) return new Response(error.message, { status: 500 });
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const user of users) {
      const isAnon = (user as { is_anonymous?: boolean }).is_anonymous === true;
      const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
      if (!isAnon || lastSignIn > idleCutoff) continue;
      candidates.push(user.id);
    }
    if (users.length < PER_PAGE) break;
    page += 1;
  }

  let deleted = 0;
  for (const id of candidates) {
    const { count } = await admin
      .from('board_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', id);
    if (count && count > 0) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (!error) deleted += 1;
  }

  return Response.json({ deleted });
});
