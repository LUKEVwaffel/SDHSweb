import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://d.sdhsjrotc.com'

// Patterns thrown by browser-injected content scripts, not by our code.
// `window.__firefox__` is Firefox for iOS's private injection object, and
// `Script error.` is the opaque message browsers report for cross-origin errors.
const BROWSER_NOISE_PATTERNS = [/__firefox__/, /^Script error\.?$/]

function isBrowserNoise(event) {
  if (!event || event.event !== '$exception') return false

  const props = event.properties || {}
  const exceptions = props.$exception_list || []
  const messages = exceptions.map((item) => `${item.type || ''}: ${item.value || ''}`)
  messages.push(props.$exception_message || '')

  return messages.some((message) => BROWSER_NOISE_PATTERNS.some((pattern) => pattern.test(message)))
}

if (apiKey && typeof window !== 'undefined') {
  posthog.init(apiKey, {
    api_host: apiHost,
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    enable_console_log_recording: true,
    capture_exceptions: true,
    person_profiles: 'identified_only',
    capture_pageview: true,
    before_send: (event) => (isBrowserNoise(event) ? null : event),
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug()
    }
  })
}

export default posthog
