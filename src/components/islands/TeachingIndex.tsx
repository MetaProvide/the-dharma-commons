import { type ReactNode, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';

export interface IndexItem {
    id: string;
    href: string;
    title: string;
    teachers: string[];
    taughtOn: string | null;
    taughtLabel: string | null;
    language: string;
    languageLabel: string;
    formats: { key: string; label: string }[];
    durationLabel: string | null;
    /** Extra words matched by the quick filter: place, session, description. */
    haystack: string;
}

export interface IndexMessages {
    list_search_label: string;
    list_search_placeholder: string;
    list_filter_teacher: string;
    list_filter_language: string;
    list_filter_format: string;
    list_filter_any: string;
    list_count_one: string;
    list_count_many: string;
    list_empty_title: string;
    list_empty_body: string;
    list_clear: string;
    list_transcript_matches: string;
    list_caption: string;
    search_loading: string;
}

interface Props {
    items: IndexItem[];
    messages: IndexMessages;
}

interface PhraseHit {
    url: string;
    title: string;
    excerpt: string;
}

interface PagefindModule {
    search: (
        term: string,
    ) => Promise<{ results: { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> }[] }>;
}

const normalise = (value: string): string =>
    value
        .toLocaleLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

/**
 * Loads Pagefind's browser bundle from the built site. Returns null in dev or if it is missing.
 */
async function loadPagefind(): Promise<PagefindModule | null> {
    try {
        const path = '/pagefind/pagefind.js';
        return (await import(/* @vite-ignore */ path)) as PagefindModule;
    } catch {
        return null;
    }
}

/**
 * Turns Pagefind's excerpt into React nodes, keeping its <mark> highlights and
 * rendering everything else as plain text (no HTML injection).
 */
function excerptNodes(excerpt: string): ReactNode[] {
    const decode = (text: string) =>
        text
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&amp;/g, '&');
    return excerpt.split(/(<mark>.*?<\/mark>)/g).map((part, index) => {
        const marked = part.match(/^<mark>(.*?)<\/mark>$/);
        const key = `${index}-${part.length}`;
        return marked ? <mark key={key}>{decode(marked[1] ?? '')}</mark> : decode(part.replace(/<[^>]*>/g, ''));
    });
}

export default function TeachingIndex({ items, messages }: Props) {
    const [query, setQuery] = useState('');
    const [teacher, setTeacher] = useState('');
    const [language, setLanguage] = useState('');
    const [format, setFormat] = useState('');
    const [phrases, setPhrases] = useState<PhraseHit[]>([]);
    const [searching, setSearching] = useState(false);
    const deferredQuery = useDeferredValue(query);
    const baseId = useId();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setQuery(params.get('q') ?? '');
        setTeacher(params.get('teacher') ?? '');
        setLanguage(params.get('language') ?? '');
        setFormat(params.get('format') ?? '');
    }, []);

    useEffect(() => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries({ q: query, teacher, language, format })) {
            if (value) {
                params.set(key, value);
            }
        }
        const search = params.toString();
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`,
        );
    }, [query, teacher, language, format]);

    const teachers = useMemo(() => [...new Set(items.flatMap((item) => item.teachers))].sort(), [items]);
    const languages = useMemo(
        () => [...new Map(items.map((item) => [item.language, item.languageLabel])).entries()],
        [items],
    );
    const formats = useMemo(
        () => [...new Map(items.flatMap((item) => item.formats.map((f) => [f.key, f.label] as const))).entries()],
        [items],
    );

    const visible = useMemo(() => {
        const words = normalise(deferredQuery).split(/\s+/).filter(Boolean);
        return items.filter((item) => {
            if (teacher && !item.teachers.includes(teacher)) {
                return false;
            }
            if (language && item.language !== language) {
                return false;
            }
            if (format && !item.formats.some((f) => f.key === format)) {
                return false;
            }
            const text = normalise(`${item.title} ${item.teachers.join(' ')} ${item.haystack}`);
            return words.every((word) => text.includes(word));
        });
    }, [items, deferredQuery, teacher, language, format]);

    useEffect(() => {
        const term = deferredQuery.trim();
        if (term.length < 3) {
            setPhrases([]);
            return;
        }
        let cancelled = false;
        setSearching(true);
        loadPagefind()
            .then(async (pagefind) => {
                if (!pagefind) {
                    return [];
                }
                const found = await pagefind.search(term);
                const data = await Promise.all(found.results.slice(0, 5).map((result) => result.data()));
                return data.map((hit) => ({ url: hit.url, title: hit.meta.title ?? hit.url, excerpt: hit.excerpt }));
            })
            .then((hits) => {
                if (!cancelled) {
                    setPhrases(hits);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setSearching(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [deferredQuery]);

    const hasFilters = Boolean(query || teacher || language || format);
    const countLabel = (visible.length === 1 ? messages.list_count_one : messages.list_count_many).replace(
        '{count}',
        String(visible.length),
    );

    const clear = () => {
        setQuery('');
        setTeacher('');
        setLanguage('');
        setFormat('');
    };

    return (
        <div className="index" data-testid="teaching-index">
            <div className="index__tools">
                <div className="field field--search">
                    <label htmlFor={`${baseId}-q`}>{messages.list_search_label}</label>
                    <input
                        id={`${baseId}-q`}
                        className="input"
                        type="search"
                        name="q"
                        autoComplete="off"
                        placeholder={messages.list_search_placeholder}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                </div>
                <div className="field">
                    <label htmlFor={`${baseId}-teacher`}>{messages.list_filter_teacher}</label>
                    <select
                        id={`${baseId}-teacher`}
                        className="select"
                        name="teacher"
                        value={teacher}
                        onChange={(event) => setTeacher(event.target.value)}
                    >
                        <option value="">{messages.list_filter_any}</option>
                        {teachers.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor={`${baseId}-language`}>{messages.list_filter_language}</label>
                    <select
                        id={`${baseId}-language`}
                        className="select"
                        name="language"
                        value={language}
                        onChange={(event) => setLanguage(event.target.value)}
                    >
                        <option value="">{messages.list_filter_any}</option>
                        {languages.map(([code, label]) => (
                            <option key={code} value={code}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label htmlFor={`${baseId}-format`}>{messages.list_filter_format}</label>
                    <select
                        id={`${baseId}-format`}
                        className="select"
                        name="format"
                        value={format}
                        onChange={(event) => setFormat(event.target.value)}
                    >
                        <option value="">{messages.list_filter_any}</option>
                        {formats.map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="index__meta">
                <p role="status" aria-live="polite" data-testid="teaching-count">
                    {countLabel}
                </p>
                {hasFilters ? (
                    <button type="button" className="btn btn--quiet" onClick={clear}>
                        {messages.list_clear}
                    </button>
                ) : null}
            </div>

            {visible.length > 0 ? (
                <ol className="index__list">
                    {visible.map((item) => (
                        <li className="index__row" key={item.id} data-testid="teaching-row">
                            <a className="index__link" href={item.href}>
                                <span className="index__title">{item.title}</span>
                                <span className="index__teachers">{item.teachers.join(', ')}</span>
                                <span className="index__when">
                                    {item.taughtOn ? <time dateTime={item.taughtOn}>{item.taughtLabel}</time> : null}
                                    <span className="visually-hidden">, </span>
                                    <span className="index__lang">{item.languageLabel}</span>
                                </span>
                                <span className="index__facts">
                                    {item.formats.map((f) => (
                                        <span className="tag" key={f.key}>
                                            {f.label}
                                        </span>
                                    ))}
                                    {item.durationLabel ? <span className="length">{item.durationLabel}</span> : null}
                                </span>
                            </a>
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="index__empty">
                    <h3>{messages.list_empty_title}</h3>
                    <p className="muted">{messages.list_empty_body}</p>
                    <button type="button" className="btn" onClick={clear}>
                        {messages.list_clear}
                    </button>
                </div>
            )}
            <p className="index__caption">{messages.list_caption}</p>

            {phrases.length > 0 || searching ? (
                <section className="index__phrases" aria-live="polite">
                    <h3>{messages.list_transcript_matches}</h3>
                    {searching && phrases.length === 0 ? <p className="muted">{messages.search_loading}</p> : null}
                    <ol>
                        {phrases.map((hit) => (
                            <li key={hit.url}>
                                <a href={hit.url}>{hit.title}</a>
                                <p>{excerptNodes(hit.excerpt)}</p>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : null}
        </div>
    );
}
