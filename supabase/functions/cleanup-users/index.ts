// Edge Function: cleanup-users (docs/plan.md §10). Service-role only.
// Deletes anonymous users with no board memberships and no sign-in for 30 days.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const IDLE_DAYS = 30;

Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (!auth.endsWith(serviceKey)) {
    return new Response('forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);
  const idleCutoff = Date.now() - IDLE_DAYS * 864e5;

  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return new Response(error.message, { status: 500 });
    const users = data.users ?? [];
    if (users.length === 0) break;

    for (const user of users) {
      const isAnon = (user as { is_anonymous?: boolean }).is_anonymous === true;
      const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
      if (!isAnon || lastSignIn > idleCutoff) continue;

      const { count } = await admin
        .from('board_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (count && count > 0) continue;

      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (!delErr) deleted += 1;
    }

    if (users.length < 200) break;
    page += 1;
  }

  return Response.json({ deleted });
});
