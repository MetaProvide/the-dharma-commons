import en from './en.json';

export const locales = { en } as const;
export type Locale = keyof typeof locales;
export type MessageKey = keyof typeof en;
export const defaultLocale: Locale = 'en';

/**
 * Looks up a UI string for a locale and fills `{name}` placeholders.
 */
export function t(
    key: MessageKey,
    params: Record<string, string | number> = {},
    locale: Locale = defaultLocale,
): string {
    const template = locales[locale][key] ?? locales[defaultLocale][key] ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Picks the singular or plural key for a count.
 */
export function tCount(one: MessageKey, many: MessageKey, count: number, locale: Locale = defaultLocale): string {
    return t(count === 1 ? one : many, { count }, locale);
}

/**
 * The subset of messages a React island needs, so islands never carry hard-coded copy.
 */
export function pick<K extends MessageKey>(keys: readonly K[], locale: Locale = defaultLocale): Record<K, string> {
    return Object.fromEntries(keys.map((key) => [key, t(key, {}, locale)])) as Record<K, string>;
}
