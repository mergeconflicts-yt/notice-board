// Edge Function: delete-account (docs/plan.md §5, §10).
//
// The app calls this with the user's JWT; the function runs delete_account()
// as that user (board cleanup) and then removes the auth user via the admin
// API. A user can only delete themselves. It is retryable: delete_account() is
// safe to run again, so a failure after cleanup can simply be retried.
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

  // Tidy board state first (as the user), so this can't orphan boards even if
  // the function is invoked directly. Safe to repeat.
  const { error: cleanupError } = await anon.rpc('delete_account');
  if (cleanupError) {
    console.error('delete-account cleanup failed:', cleanupError.message);
    return new Response('could not delete account', { status: 500 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    // Cleanup already ran; a retry will just attempt the user delete again.
    console.error('delete-account admin delete failed:', error.message);
    return new Response('could not delete account', { status: 500 });
  }

  return new Response(null, { status: 204 });
});

