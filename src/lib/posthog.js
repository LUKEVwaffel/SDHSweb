import posthog from 'posthog-js'

const apiKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://d.sdhsjrotc.com'

if (apiKey && typeof window !== 'undefined') {
  posthog.init(apiKey, {
    api_host: apiHost,
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    enable_console_log_recording: true,
    person_profiles: 'identified_only',
    capture_pageview: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) ph.debug()
    }
  })
}

export default posthog
