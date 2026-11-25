# The Dharma Commons

Public library of recorded Buddhist teachings preserved on the Swarm network. Domain: `thedharmacommons.org`.
The spec is [BRIEF.md](BRIEF.md).

## Run it

Requires pnpm. The project pins Node 24 through `.npmrc` (`use-node-version`), so pnpm fetches the right Node for
its scripts without touching your global install.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for tests
pnpm dev                                # http://localhost:4321
pnpm build                              # static site in dist/, then the Pagefind index
pnpm preview                            # serve dist/
pnpm lint                               # Biome
pnpm check                              # astro check (TypeScript 6; astro check does not support 7 yet)
pnpm run deploy                         # build, then deploy dist/ to Cloudflare Workers static assets (wrangler.jsonc)
pnpm og                                 # re-render public/og.png from the built home page
pnpm test                               # Playwright smoke tests (builds must exist: run pnpm build first)
SCREENSHOTS=1 pnpm test tests/screenshots.spec.ts   # review screenshots into screenshots/
```

## Data

`src/data/teachings.json` is a snapshot of the approved, ready records from the Joyma archive (taken from
`joyma.co/archive` on 2026-11-25, 11 teachings), in the shape of Joyma's public archive Data classes. Transcripts in
`src/data/transcripts/` are the exact files stored on Swarm; the build refuses to run if one does not match its
recorded SHA-256. The live Joyma API replaces the snapshot in a later step (see BRIEF.md § 2).

Only records with `import_status = ready` and `review_status = approved` may be added.
