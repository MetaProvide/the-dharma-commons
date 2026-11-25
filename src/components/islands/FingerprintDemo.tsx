import { useEffect, useId, useState } from 'react';
import { sha256Hex } from '../../lib/sha256';

export interface FingerprintMessages {
    teaser_original: string;
    teaser_yours: string;
    teaser_match: string;
    teaser_differs: string;
    teaser_edit_label: string;
}

interface Props {
    line: string;
    /** SHA-256 of `line`, computed at build time so the page reads fully without scripting. */
    lineHash: string;
    messages: FingerprintMessages;
}

function HashGroups({ hash, against }: { hash: string; against?: string }) {
    const groups = Array.from({ length: Math.ceil(hash.length / 8) }, (_, n) => ({
        offset: n * 8,
        text: hash.slice(n * 8, n * 8 + 8),
    }));
    return (
        <code className="print__hash">
            {groups.map(({ offset, text: group }) => {
                const differs = against ? against.slice(offset, offset + 8) !== group : false;
                return (
                    <span key={offset} data-diff={differs ? 'true' : 'false'}>
                        {group}
                    </span>
                );
            })}
        </code>
    );
}

/**
 * Two copies of one real transcript line: the sealed one and an editable one.
 * The visitor's browser fingerprints their copy on every keystroke.
 */
export default function FingerprintDemo({ line, lineHash, messages }: Props) {
    const [copy, setCopy] = useState(line);
    const [copyHash, setCopyHash] = useState(lineHash);
    const editId = useId();

    useEffect(() => {
        let cancelled = false;
        sha256Hex(new TextEncoder().encode(copy)).then((hash) => {
            if (!cancelled) {
                setCopyHash(hash);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [copy]);

    const matches = copyHash === lineHash;

    return (
        <div className="print__pair" data-testid="fingerprint-demo">
            <div className="print__side">
                <p className="print__label">{messages.teaser_original}</p>
                <p className="print__line">{line}</p>
                <HashGroups hash={lineHash} />
                <p className="print__status">
                    <span className="tag tag--in">{messages.teaser_match}</span>
                </p>
            </div>
            <div className="print__side">
                <label className="print__label" htmlFor={editId}>
                    {messages.teaser_yours}
                    <span className="visually-hidden">, {messages.teaser_edit_label}</span>
                </label>
                <textarea
                    id={editId}
                    className="print__edit"
                    rows={2}
                    spellCheck={false}
                    value={copy}
                    onChange={(event) => setCopy(event.target.value)}
                    data-testid="fingerprint-input"
                />
                <HashGroups hash={copyHash} against={lineHash} />
                <p className="print__status" role="status" aria-live="polite" data-testid="fingerprint-status">
                    <span className={matches ? 'tag tag--in' : 'tag tag--out'}>
                        {matches ? messages.teaser_match : messages.teaser_differs}
                    </span>
                </p>
            </div>
        </div>
    );
}
