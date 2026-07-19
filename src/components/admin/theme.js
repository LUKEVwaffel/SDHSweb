// Shared admin theme tokens. Single source for palette + fonts + passcode.
export const P = {
  ink: '#06101F', navy: '#142847', deep: '#0A1628',
  gold: '#C9A961', bright: '#E8C77A', cream: '#F4ECD8',
  mute: 'rgba(244,236,216,0.55)', hair: 'rgba(201,169,97,0.22)',
  red: '#C0392B', green: '#27AE60', blue: '#2980B9',
};

export const mono = "'JetBrains Mono', monospace";
export const oswald = "Oswald, sans-serif";
export const inter = "Inter, sans-serif";

// Client-side passcode gate. Not real auth — same posture as the rest of the
// admin (anon key + RLS). Real fix = Supabase Auth.
export const PASSCODE = 'TROJANS6';
