# The Dharma Commons — build brief

Domain: **thedharmacommons.org** (registered). A public, community-feeling library of Buddhist teachings preserved on
the Swarm network. Its only MetaProvide branding is a footer line, **"Powered by MetaProvide"**, linking to
https://metaprovide.org/archive/. When it launches, the "Visit Joyma" button on that MetaProvide page will point here
instead.

The teachings, metadata and review workflow already exist in Joyma (repo `../lotus`, Laravel + Inertia). This site is a
new public front door to the same approved records. It never shows Joyma branding, logins or booking links.

---

## 1. What the site must say, in order of importance

Keep the information priorities of Joyma's archive (`../lotus/resources/js/pages/archive/*.tsx`), not its layout.

1. **The teachings.** The listing is the heart of the home page, visible without much scrolling: search, filter by
   teacher / language / format, newest teaching first (same order as Joyma: `taught_on` desc, then title). Each card
   shows the title, teachers, the date taught, the language, the formats (audio / text / video / photo) and the duration.
2. **Listen and read.** The teaching page opens with the player and a readable transcript (with a choice of file when
   there are several), then the date, teachers, place, session, language and description.
3. **How Swarm keeps it.** A scroll-driven explainer, one step per screen: _Recorded → Sealed with a fingerprint →
   Spread across many computers → Found & checked_. Use the before/after fingerprint idea from metaprovide.org/archive
   (the original matches, an altered copy gets a different fingerprint). This is the showcase moment; it can also be a
   short version on the home page plus a full `/how-it-works` page.
4. **Check this copy.** A button on each teaching that downloads a file from the Swarm gateway **in the visitor's own
   browser**, computes SHA-256 with `crypto.subtle` and compares it with the hash recorded in the metadata. No server
   involved, which is stronger than Joyma's server-side check and is the point of the showcase. Show three states:
   verified, does not match, could not fetch. For very large audio files (over ~150 MB), say the check may be slow and
   offer the hash to copy instead.
5. **Source and files** (secondary, in a drawer, tab or "details" panel rather than the main column): Swarm reference
   with a copy button, "Open on Swarm" link, the file list with sizes and SHA-256, original sources (publisher, original
   page, audio, edited transcript, video playlist, notes), rights, archive ID, packaged at / by, postage batch, and
   "Storage paid for by MetaProvide".
6. **About / honesty.** Carry over Joyma's wording on availability: content-addressed means _tamper-evident, not
   tamper-proof_. A correction becomes a new address, and Swarm storage is prepaid rent that must be topped up, not a
   promise of forever. No personal data about participants is ever stored on Swarm.
7. **Contribute.** A short page for teachers and centres who want their teachings preserved, with a contact email
   shown as text (no form backend in phase 1).

Copy and wording sources to reuse (rewrite for the new brand, don't say "Joyma"):

- `../lotus/messages/en.json` — every key starting `archive_` (about page, detail labels, verification messages, source
  roles).
- https://metaprovide.org/archive/ — the story (Nalanda, the Tibetan libraries, Dharamsala), the four steps, and the
  fingerprint diagram.

## 2. Data

### Record shape (mirror Joyma's public Data classes)

From `../lotus/app/Data/Archive/`:

- `PublicArchiveRecordData`: `id, title, teacherNames[], formats[], language, taughtOn, durationLabel`
- `PublicArchiveDetailData`: `summary, reference, collectionUrl, postageStamp, session, description, place, archiveId,
  rights, packagedAt, packagedBy, files[], sources[]`
- `ArchiveFileData`: `path, content_type, kind (text|audio|video|photo), bytes, gateway_url, sha256`
- `PublicArchiveSourceData`: `role, value, url` (roles: archive, publisher, original_page, listen_audio,
  download_audio, edited_transcript, transcript_collection, transcript_archive, video_playlist, note, source_detail)

Only records with `import_status = ready` **and** `review_status = approved` are public. Never publish anything else.

Swarm gateway: `https://bzz.link/bzz/{reference}/{path}` (Joyma's `SWARM_GATEWAY` default). Each teaching is one Swarm
collection with `metadata.json`, audio, transcript files. Metadata schema:
`../lotus/.serena/memories/docs/Knowledge/features/swarm-archive/metadata.schema.json`.

### Where the data comes from

- **Step 1 (unblocks design):** a committed snapshot `src/data/teachings.json` in the shape above. Build it from real
  data: ask the user to export it from Joyma (local `https://lotus.local.rip/archive` or staging), or read the sample
  teachings in `../lotus/.serena/memories/docs/Knowledge/features/swarm-archive/*/metadata.json`. No invented
  teachings, teachers or dates.
- **Step 2 (separate PR in `../lotus`, not in this repo):** a public read-only Joyma endpoint, e.g.
  `GET /api/v1/archive-records` (JSON:API, approved records only, translated titles per locale), following that repo's
  CLAUDE.md rules. The Astro build fetches it at build time and falls back to the snapshot if it fails. A Joyma
  event (record approved) can later trigger a rebuild through a deploy hook.

## 3. Tech

- **Astro** (current stable), `output: 'static'`. Content Layer collection for teachings with a Zod schema matching the
  shapes above; one static page per teaching at `/teachings/[id]`.
- **Tailwind CSS v4.** Plain `.astro` components by default; React islands only where needed (search/filter, player +
  transcript sync, "Check this copy", copy-reference). 21st.dev components are React, so use them as islands.
- **Search:** Pagefind over the built site, so transcripts are searchable, not just titles.
- **i18n:** Astro i18n routing, English first, every string in a messages file (the platform serves many countries;
  no hard-coded copy in components). Teaching titles keep their own locale.
- **Scroll effects:** CSS scroll-driven animations first, a small library only if needed. Respect
  `prefers-reduced-motion`; the page must read fully with motion off.
- **Quality:** TypeScript strict, Biome for lint/format, Playwright smoke tests (home, listing filter, teaching page,
  verification success + mismatch with a mocked gateway), Lighthouse ≥ 95 on performance and accessibility, both
  themes.
- **Hosting:** any static host for phase 1 (decide with the user). Phase 2: publish `dist/` to Swarm with
  `swarm-cli` behind a feed, so the website itself is decentralised.
- **Analytics:** privacy-friendly only (no cookies), or none.

## 4. Design tools to use

- **Hallmark** (installed: `~/.claude/skills/hallmark`) — design direction, then `/hallmark audit` on built pages.
  It outputs HTML/CSS; translate its decisions into Astro components rather than pasting its single file.
- **iso-glow** (isoglow.dev) — isometric glowing illustrations for the Swarm explainer (node network, chunks
  spreading, the fingerprint seal). Install:
  `mkdir -p ~/.claude/skills && curl -fsSL https://iso-glow.vercel.app/iso-glow.tar.gz | tar -xz -C ~/.claude/skills`
- **scroll-craft** — scroll-driven sections for the explainer.
  `/plugin marketplace add nateherkai/scroll-craft` then `/plugin install nateherk-design`
- **21st.dev Magic** — UI components (search, cards, drawers) as React islands.
  `npx @21st-dev/cli@latest init --client claude`
- **Mobbin** — reference for library/archive/listening-app patterns. MCP at `https://api.mobbin.com/mcp` (needs a paid
  plan); otherwise browse it manually for references.

Design direction: calm, contemplative, a library rather than a product. Warm paper and ink rather than tech gradients,
generous reading typography for transcripts, quiet motion. Avoid Joyma's and MetaProvide's look so it reads as its
own community.

## 5. Build order

1. Scaffold Astro + Tailwind + Biome + Playwright, git init, README with run commands.
2. Teachings snapshot + content collection + types.
3. Design direction with Hallmark (tokens, type, layout), checked with the user before building pages.
4. Home: hero thesis, the listing with search and filters, short Swarm teaser.
5. Teaching page: player, transcript, details, "Check this copy", Source and files panel.
6. `/how-it-works` scroll explainer with iso-glow illustrations.
7. About, Contribute, footer ("Powered by MetaProvide"), 404, share previews, sitemap.
8. Pagefind, i18n wiring, accessibility and performance pass, Playwright tests.
9. Deploy preview; then the Joyma API PR and the switch from snapshot to live data.
