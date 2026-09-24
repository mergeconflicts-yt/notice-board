// Edge Function: delete-account (docs/plan.md §5, §10).
//
// Called by the app AFTER the delete_account() RPC has tidied board state.
// Postgres cannot safely delete auth.users, so this uses the admin API with
// the service-role key. The caller's JWT identifies the user; a user can only
// delete themselves.
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('missing authorization', { status: 401 });
  }

  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError || !user) {
    return new Response('not authenticated', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return new Response(error.message, { status: 500 });
  }

  return new Response(null, { status: 204 });
});
