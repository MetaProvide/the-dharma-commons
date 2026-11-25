import { defineCollection } from 'astro:content';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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
 * Reads the committed transcript for a teaching and refuses to build if it is not
 * byte-identical to the text file recorded on Swarm.
 */
async function readTranscript(id: string, files: { kind: string; sha256: string }[]): Promise<string | null> {
    const expected = files.find((file) => file.kind === 'text')?.sha256;
    if (!expected) {
        return null;
    }
    let bytes: Buffer;
    try {
        bytes = await readFile(join(process.cwd(), 'src/data/transcripts', `${id}.txt`));
    } catch {
        return null;
    }
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== expected) {
        throw new Error(`Transcript for ${id} does not match its Swarm SHA-256 (${actual} != ${expected}).`);
    }
    return bytes.toString('utf8');
}

const teachings = defineCollection({
    loader: async () =>
        Promise.all(
            snapshot.teachings.map(async (teaching) => ({
                id: teaching.summary.id,
                ...teaching,
                transcript: await readTranscript(teaching.summary.id, teaching.files),
            })),
        ),
    schema: teachingSchema,
});

export const collections = { teachings };
