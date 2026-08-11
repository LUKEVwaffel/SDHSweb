import { P } from '../admin/theme.js';

// Shared hairline divider between right-column instrument-panel sections
// (Clock, Weather, Shoutouts, Facts/Quote) — departure-board style, no
// per-widget border/shadow/radius. Extracted to its own file (rather than
// staying a TvKiosk.jsx-local function) so TvShoutoutsPanel.jsx can own its
// own divider and omit both together when it has nothing to show, without a
// circular import back to TvKiosk.jsx.
export default function TvInstrumentDivider() {
  return (
    <div style={{
      height: 1, flexShrink: 0,
      background: `linear-gradient(90deg, transparent, ${P.hairStrong} 12%, ${P.hairStrong} 88%, transparent)`,
    }} />
  );
}
