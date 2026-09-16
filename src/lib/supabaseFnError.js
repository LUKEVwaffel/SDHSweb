import { FunctionsHttpError } from '@supabase/supabase-js';

// Shared by every *Api.js wrapper around a public edge function.
// supabase-js's functions.invoke() does NOT surface the edge function's JSON
// error body on a non-2xx response: `data` is null and `error` is a
// FunctionsHttpError whose .message is the fixed string "Edge Function
// returned a non-2xx status code". The real { error: "..." } is on
// error.context (an unread Response) — read it here so callers get the actual
// reason instead of that opaque line.
export async function invokeError(data, error, fallback) {
  if (data?.error) return data.error;
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return error?.message || fallback;
}
