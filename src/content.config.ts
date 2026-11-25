import { defineCollection } from 'astro:content';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'astro/zod';
import snapshot from './data/teachings.json';

/**
 * Mirrors Joyma's public archive contracts (app/Data/Archive):
 * PublicArchiveRecordData, PublicArchiveDetailData, ArchiveFileData, PublicArchiveSourceData.
 */
export const formatSchema = z.enum(['audio', 'text', 'video', 'photo']);

export const sourceRoles = [
    'archive',
    'publisher',
    'original_page',
    'listen_audio',
    'download_audio',
    'edited_transcript',
    'transcript_collection',
    'transcript_archive',
    'video_playlist',
    'note',
    'source_detail',
] as const;

const summarySchema = z.object({
    id: z.string(),
    title: z.string(),
    teacherNames: z.array(z.string()),
    formats: z.array(formatSchema),
    language: z.string(),
    taughtOn: z.string().nullable(),
    durationLabel: z.string().nullable(),
});

const fileSchema = z.object({
    path: z.string(),
    content_type: z.string(),
    kind: formatSchema,
    bytes: z.number().int().nonnegative(),
    gateway_url: z.url(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

const sourceSchema = z.object({
    role: z.enum(sourceRoles),
    value: z.string(),
    url: z.url().nullable(),
});

const teachingSchema = z.object({
    summary: summarySchema,
    reference: z.string().regex(/^[0-9a-f]{64}$/),
    collectionUrl: z.url(),
    postageStamp: z.string().nullable(),
    session: z.string().nullable(),
    description: z.string().nullable(),
    place: z.string().nullable(),
    archiveId: z.string().nullable(),
    rights: z.string().nullable(),
    packagedAt: z.string().nullable(),
    packagedBy: z.string().nullable(),
    files: z.array(fileSchema),
    sources: z.array(sourceSchema),
    /** Plain-text transcript, committed beside the snapshot and checked against its SHA-256 at build time. */
    transcript: z.string().nullable(),
});

export type Teaching = z.infer<typeof teachingSchema>;
export type TeachingFile = z.infer<typeof fileSchema>;
export type TeachingSource = z.infer<typeof sourceSchema>;
export type TeachingFormat = z.infer<typeof formatSchema>;

/**
 * Transcripts are copyrighted and are not kept in this public repository. The build reads
 * them from Swarm (the same bytes the site lets visitors check), caches them outside git in
 * `.cache/transcripts/`, and refuses any copy that is not byte-identical to the SHA-256
 * recorded when the teaching was sealed.
 */
const transcriptCache = join(process.cwd(), '.cache', 'transcripts');

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** Public Swarm gateways, tried in order. Any of them serves the same content-addressed bytes. */
const gateways = ['https://bzz.link/bzz', 'https://api.gateway.ethswarm.org/bzz'];

/**
 * Fetches a file from Swarm through each gateway in turn, with a few attempts each,
 * and returns the first copy whose SHA-256 matches.
 */
async function fetchVerified(reference: string, path: string, expected: string): Promise<Uint8Array> {
    const failures: string[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
        for (const gateway of gateways) {
            const url = `${gateway}/${reference}/${path}`;
            try {
                const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
                if (!response.ok) {
                    failures.push(`${url}: HTTP ${response.status}`);
                    continue;
                }
                const bytes = new Uint8Array(await response.arrayBuffer());
                const actual = sha256(bytes);
                if (actual === expected) {
                    return bytes;
                }
                failures.push(`${url}: SHA-256 ${actual}`);
            } catch (error) {
                failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
    throw new Error(`No Swarm gateway returned ${path} with SHA-256 ${expected}.\n${failures.join('\n')}`);
}

async function readTranscript(
    reference: string,
    files: { kind: string; sha256: string; path: string }[],
): Promise<string | null> {
    const textFile = files.find((file) => file.kind === 'text');
    if (!textFile) {
        return null;
    }
    const cachePath = join(transcriptCache, `${textFile.sha256}.txt`);

    try {
        const cached = await readFile(cachePath);
        if (sha256(cached) === textFile.sha256) {
            return cached.toString('utf8');
        }
    } catch {
        // Not cached yet: fetch it from Swarm below.
    }

    const bytes = await fetchVerified(reference, textFile.path, textFile.sha256);
    await mkdir(transcriptCache, { recursive: true });
    await writeFile(cachePath, bytes);
    return Buffer.from(bytes).toString('utf8');
}

const teachings = defineCollection({
    loader: async () =>
        Promise.all(
            snapshot.teachings.map(async (teaching) => ({
                id: teaching.summary.id,
                ...teaching,
                transcript: await readTranscript(teaching.reference, teaching.files),
            })),
        ),
    schema: teachingSchema,
});

export const collections = { teachings };
