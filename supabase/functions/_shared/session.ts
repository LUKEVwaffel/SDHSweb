import { serviceClient } from "./supabase.ts";

// Mint a real Supabase (GoTrue) session for an already-verified account WITHOUT
// hand-signing JWTs. generateLink produces a magic-link hashed_token; the client
// exchanges it via supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) to
// receive a genuine access + refresh token pair. GoTrue owns the JWT lifecycle.
//
// This is the shared endpoint for BOTH the PIN and (future) passkey login paths:
// each verifies its own credential, then calls this to hand the caller a session.
// The account must already exist as a Supabase Auth user.
export async function mintSessionToken(email: string): Promise<string> {
  const svc = serviceClient();
  const { data, error } = await svc.auth.admin.generateLink({ type: "magiclink", email });
  const token = data?.properties?.hashed_token;
  if (error || !token) {
    throw new Error(error?.message || "could not mint session (is the account a Supabase Auth user?)");
  }
  return token;
}
