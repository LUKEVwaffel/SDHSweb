# PostHog Source Map Upload — Setup Report

## Files Changed

| File | Change |
|------|--------|
| `vite.config.js` | Added `build: { sourcemap: true }` so Vite emits `.map` files alongside bundles |
| `package.json` | Updated `build` script to run `posthog-cli --dotenv-file .env sourcemap process --directory ./dist` after `vite build`; added `@posthog/cli` devDependency |
| `.env` | Added `POSTHOG_CLI_API_KEY`, `POSTHOG_CLI_PROJECT_ID`, `POSTHOG_CLI_HOST` |

## Build & Upload Command

```
npm run build
```

This runs `vite build` (emits source maps to `dist/`) then:

```
posthog-cli --dotenv-file .env sourcemap process --directory ./dist
```

The `process` subcommand injects chunk IDs into the bundles and uploads the maps to PostHog in one step. The `--dotenv-file .env` flag makes the CLI read credentials from `.env` — you must run from the project root.

## Run Command (local preview)

```
npm run preview
```

## Credentials Written to .env

```
POSTHOG_CLI_API_KEY=<your personal API key>
POSTHOG_CLI_PROJECT_ID=542711
POSTHOG_CLI_HOST=https://us.posthog.com
```

**Note:** `POSTHOG_CLI_HOST` is the PostHog API host — always `https://us.posthog.com`, never the custom ingestion proxy (`d.sdhsjrotc.com`) used by the runtime SDK.

## CI / Deploy — Action Required

This project deploys via **Vercel** (no CI config file exists to edit). Vercel runs `npm run build` automatically on each push — it will pick up the new build script, but it needs the upload credentials available as environment variables in the Vercel project.

**You must add these three secrets in the Vercel dashboard before your next deploy:**

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add each variable (for **Production** environment at minimum):

| Variable | Value |
|----------|-------|
| `POSTHOG_CLI_API_KEY` | Your personal PostHog API key |
| `POSTHOG_CLI_PROJECT_ID` | `542711` |
| `POSTHOG_CLI_HOST` | `https://us.posthog.com` |

Without these, the build will succeed but `posthog-cli` will fail to authenticate and maps will not upload on Vercel deploys.

## Test Affordance

A temporary "Test PostHog Error Tracking" button was added to `src/App.jsx` and reverted after testing.

## Verifying Uploads

After running `npm run build`, confirm the upload landed at:

**https://us.posthog.com/project/542711/error_tracking/configuration**

A new symbol set entry should appear. Once uploaded, stack traces in Error Tracking will show your original source file paths and line numbers instead of minified bundle references.
