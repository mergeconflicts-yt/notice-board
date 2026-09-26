// Edge Function: upload-photo.
//
// The ONLY writer of board-photos bytes: the storage policy admits no direct
// client uploads. The app sends the raw picked image; this function decodes
// it (rejecting anything that is not decodable image data), downsizes to a
// 2048px longest side, and re-encodes as JPEG — the re-encode is what strips
// EXIF/GPS and normalises arbitrary input bytes into real image data. The
// output is stored at the caller's live intent path and the intent's
// byte_size is recorded for the per-account storage quota.
//
// Auth: caller JWT (verify_jwt on), intent must belong to the caller.
// Retryable: re-uploading to the same intent path overwrites (upsert).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'jsr:@cross/image';

const BUCKET = 'board-photos';
const MAX_SIDE = 2048;
const JPEG_QUALITY = 80;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(message: string, status = 400): Response {
  return new Response(message, { status });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return bad('method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return bad('missing authorization', 401);

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await anon.auth.getUser();
  if (authError || !user) return bad('not authenticated', 401);

  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) return bad('invalid_input');
  let path = '';
  let file: File | null = null;
  try {
    const form = await req.formData();
    const pathValue = form.get('path');
    if (typeof pathValue === 'string') path = pathValue;
    const fileValue = form.get('file');
    if (fileValue instanceof File) file = fileValue;
  } catch {
    return bad('invalid_input');
  }
  const parts = path.split('/');
  if (parts.length !== 3 || !UUID_RE.test(parts[0]) || !UUID_RE.test(parts[1]) || !parts[2].endsWith('.jpg')) {
    return bad('invalid_input');
  }

  // The intent must be live, unconsumed, and owned by the caller. The
  // service-role read below bypasses RLS; ownership is enforced here.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: intent, error: intentError } = await admin
    .from('photo_upload_intents')
    .select('path, board_id, item_id, user_id, consumed, expires_at')
    .eq('path', path)
    .maybeSingle();
  if (intentError) {
    console.error('upload-photo intent lookup failed:', intentError.message);
    return bad('could not upload photo', 500);
  }
  if (
    !intent ||
    intent.user_id !== user.id ||
    intent.consumed ||
    Date.parse(intent.expires_at) <= Date.now()
  ) {
    return bad('invalid_input');
  }

  // Caller must still be a member of the live board (membership may have
  // lapsed between intent issue and upload).
  const { data: membership } = await admin
    .from('board_members')
    .select('user_id, boards!inner(deleted_at)')
    .eq('board_id', intent.board_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || (membership.boards as unknown as { deleted_at: string | null }).deleted_at !== null) {
    return bad('not_member', 403);
  }

  if (!file) return bad('invalid_input');
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) return bad('invalid_input');

  // Decode: rejects anything that is not image data (arbitrary bytes labelled
  // as JPEG fail here). Strict mode — no tolerant partial decode.
  let image;
  try {
    image = await Image.decode(new Uint8Array(await file.arrayBuffer()), undefined, {
      tolerantDecoding: false,
      runtimeDecoding: 'never',
    } as never);
  } catch {
    return bad('invalid_input');
  }

  // Downsize to the same 2048px longest side the client targets, then
  // re-encode as JPEG: the output carries no EXIF/GPS and is real image data.
  const longest = Math.max(image.width, image.height);
  if (longest > MAX_SIDE) {
    const scale = MAX_SIDE / longest;
    image.resize({
      width: Math.max(1, Math.round(image.width * scale)),
      height: Math.max(1, Math.round(image.height * scale)),
    });
  }
  let jpeg: Uint8Array;
  try {
    jpeg = await image.encode('jpeg', { quality: JPEG_QUALITY });
  } catch (e) {
    console.error('upload-photo encode failed:', (e as Error)?.message ?? e);
    return bad('could not upload photo', 500);
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    console.error('upload-photo storage write failed:', uploadError.message);
    return bad('could not upload photo', 500);
  }

  const { error: sizeError } = await admin
    .from('photo_upload_intents')
    .update({ byte_size: jpeg.length })
    .eq('path', path);
  if (sizeError) {
    console.error('upload-photo byte_size update failed:', sizeError.message);
    return bad('could not upload photo', 500);
  }

  return Response.json({ path, byte_size: jpeg.length });
});
