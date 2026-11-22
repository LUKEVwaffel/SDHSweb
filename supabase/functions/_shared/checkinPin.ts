export async function checkinTag(purpose: "pin" | "network", value: string): Promise<string> {
  const utf8 = new TextEncoder();
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) throw new Error("Check-in credential key is missing");
  const key = await crypto.subtle.importKey("raw", utf8.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, utf8.encode(`ball-checkin:${purpose}:${value}`));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function newCheckinPin(): string {
  const buffer = new Uint16Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= 60000);
  return String(buffer[0] % 10000).padStart(4, "0");
}
