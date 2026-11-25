# The Dharma Commons

Public library of recorded Buddhist teachings preserved on the Swarm network. Live at https://dharmacommons.org (www. and dharmacommons.com redirect there).
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
pnpm run deploy                         # manual deploy; normally every push to main deploys through Cloudflare Workers Builds
pnpm og                                 # re-render public/og.png from the built home page
pnpm test                               # Playwright smoke tests (builds must exist: run pnpm build first)
SCREENSHOTS=1 pnpm test tests/screenshots.spec.ts   # review screenshots into screenshots/
```

## Data

`src/data/teachings.json` is a snapshot of the approved, ready records from the Joyma archive (taken from
`joyma.co/archive` on 2026-11-25, 11 teachings), in the shape of Joyma's public archive Data classes. Transcripts are copyrighted
and are never committed: the build fetches each one from Swarm, checks it against its recorded SHA-256, and caches it in
`.cache/transcripts/` (git-ignored). A copy that does not match stops the build. The live Joyma API replaces the snapshot in a later step (see BRIEF.md § 2).

Only records with `import_status = ready` and `review_status = approved` may be added.
