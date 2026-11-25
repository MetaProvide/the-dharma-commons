import { type CollectionEntry, getCollection } from 'astro:content';
import { defaultLocale, type Locale, type MessageKey, t } from '../i18n';

export type TeachingEntry = CollectionEntry<'teachings'>;

/** Swarm gateway the site reads from (Joyma's SWARM_GATEWAY default). */
export const swarmGateway = 'https://bzz.link/bzz';

/**
 * All public teachings, newest first, then by title (the same order as Joyma's archive).
 */
export async function getTeachings(): Promise<TeachingEntry[]> {
    const entries = await getCollection('teachings');
    return entries.sort((a, b) => {
        const byDate = (b.data.summary.taughtOn ?? '').localeCompare(a.data.summary.taughtOn ?? '');
        return byDate !== 0 ? byDate : a.data.summary.title.localeCompare(b.data.summary.title);
    });
}

export function formatDate(isoDate: string | null, locale: Locale = defaultLocale): string | null {
    if (!isoDate) {
        return null;
    }
    if (/^\d{4}$/.test(isoDate)) {
        return isoDate;
    }
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function languageName(code: string, locale: Locale = defaultLocale): string {
    const key = `lang_${code}` as MessageKey;
    const translated = t(key, {}, locale);
    if (translated !== key) {
        return translated;
    }
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
}

export function formatBytes(bytes: number, locale: Locale = defaultLocale): string {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit += 1;
    }
    return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit: units[unit],
        unitDisplay: 'short',
        maximumFractionDigits: unit === 0 ? 0 : 1,
    }).format(value);
}

/** "3:27:08" -> "3 h 27 min", for people rather than players. */
export function formatDuration(label: string | null): string | null {
    if (!label) {
        return null;
    }
    const parts = label.split(':').map(Number);
    const [hours, minutes] = parts.length === 3 ? parts : [0, parts[0] ?? 0];
    return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export function wordCount(text: string | null): number {
    return text ? text.trim().split(/\s+/).length : 0;
}

/** Splits a transcript into readable paragraphs, dropping the ASCII rule lines of the packaged file. */
export function transcriptParagraphs(text: string | null): string[] {
    if (!text) {
        return [];
    }
    return text
        .split(/\n\s*\n/)
        .map((block) => block.replace(/^=+$/gm, '').trim())
        .filter((block) => block.length > 0);
}
