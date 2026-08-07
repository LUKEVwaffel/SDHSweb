import TvHistoryPanel from './TvHistoryPanel.jsx';
import TvQuotePanel from './TvQuotePanel.jsx';
import TvVersePanel from './TvVersePanel.jsx';
import TvCustomMessagePanel from './TvCustomMessagePanel.jsx';

// If the 1SGT hasn't touched the control center in this many days, any
// non-default mode (including a stale Custom message) falls back to Facts.
// Display-only: never writes back to the row, so his last choice is still
// there, untouched, next time he opens the control center.
const STALE_DAYS = 3;
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

function isStale(modeSetAt, now) {
  if (!modeSetAt) return true;
  return now - new Date(modeSetAt) > STALE_MS;
}

export default function TvBottomWidget({ settings, now }) {
  const rawMode = settings?.bottom_widget_mode ?? 'facts';
  const stale = rawMode !== 'facts' && isStale(settings?.mode_set_at, now);
  const mode = stale ? 'facts' : rawMode;

  if (mode === 'quote') return <TvQuotePanel selectedIds={settings?.selected_quote_ids ?? []} />;
  if (mode === 'verse') return <TvVersePanel selectedIds={settings?.selected_verse_ids ?? []} />;
  if (mode === 'custom') return <TvCustomMessagePanel message={settings.custom_message} signoff={settings.custom_signoff} />;
  return <TvHistoryPanel />;
}
