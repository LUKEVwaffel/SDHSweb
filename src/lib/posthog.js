import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://d.sdhsjrotc.com'

// Symbols that browser-injected scripts (not our code) throw. Exceptions that
// name one of these come from the visitor's browser, not the page we ship, so
// drop them before they reach error tracking.
const injectedSymbols = ['__firefox__']

function isBrowserInjectedException(event) {
  const values = event?.properties?.$exception_list
  if (!Array.isArray(values)) return false
  return values.some((value) => {
    const message = value?.value || ''
    return injectedSymbols.some((symbol) => message.includes(symbol))
  })
}

// Never send events from a local development server. Half-saved files during
// Vite hot-module-replacement throw ReferenceErrors that cannot survive a
// production build, so they are noise in error tracking.
const isLocalhost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)

if (apiKey && typeof window !== 'undefined' && !isLocalhost) {
  posthog.init(apiKey, {
    api_host: apiHost,
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    enable_console_log_recording: true,
    capture_exceptions: true,
    person_profiles: 'identified_only',
    capture_pageview: true,
    before_send: (event) => {
      if (event?.event === '$exception' && isBrowserInjectedException(event)) {
        return null
      }
      return event
    }
  })
}

export default posthog
