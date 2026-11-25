import { useId, useState } from 'react';
import { sha256Hex } from '../../lib/sha256';

export interface CheckFile {
    path: string;
    url: string;
    bytes: number;
    sizeLabel: string;
    sha256: string;
}

export interface CheckMessages {
    check_title: string;
    check_intro: string;
    check_file: string;
    check_button: string;
    check_again: string;
    check_running: string;
    check_progress: string;
    check_verified: string;
    check_mismatch: string;
    check_fetch_failed: string;
    check_expected: string;
    check_actual: string;
    check_large: string;
    check_large_anyway: string;
    check_copy_hash: string;
    check_copied: string;
    check_self: string;
    check_tag_verified: string;
    check_tag_mismatch: string;
}

interface Props {
    files: CheckFile[];
    messages: CheckMessages;
    /** Files larger than this ask before downloading (the brief: about 150 MB). */
    largeBytes?: number;
}

type CheckState =
    | { status: 'idle' }
    | { status: 'running'; received: number }
    | { status: 'verified'; actual: string }
    | { status: 'mismatch'; actual: string }
    | { status: 'failed' };

/**
 * Downloads one file from the Swarm gateway in the visitor's browser, fingerprints it
 * with SHA-256 and compares it with the hash recorded when the teaching was sealed.
 */
async function fetchAndHash(url: string, onProgress: (received: number) => void): Promise<string> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok || !response.body) {
        throw new Error(`Gateway answered ${response.status}`);
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let received = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        parts.push(value);
        received += value.byteLength;
        onProgress(received);
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const part of parts) {
        bytes.set(part, offset);
        offset += part.byteLength;
    }
    return sha256Hex(bytes);
}

export default function CheckCopy({ files, messages, largeBytes = 150_000_000 }: Props) {
    const [selected, setSelected] = useState(files[0]?.path ?? '');
    const [state, setState] = useState<CheckState>({ status: 'idle' });
    const [confirmedLarge, setConfirmedLarge] = useState(false);
    const [copied, setCopied] = useState(false);
    const selectId = useId();
    const file = files.find((candidate) => candidate.path === selected) ?? files[0];

    if (!file) {
        return null;
    }

    const isLarge = file.bytes > largeBytes && !confirmedLarge;

    const run = async () => {
        setState({ status: 'running', received: 0 });
        try {
            const actual = await fetchAndHash(file.url, (received) => setState({ status: 'running', received }));
            setState(actual === file.sha256 ? { status: 'verified', actual } : { status: 'mismatch', actual });
        } catch {
            setState({ status: 'failed' });
        }
    };

    const copyHash = async () => {
        try {
            await navigator.clipboard.writeText(file.sha256);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const percent = state.status === 'running' ? Math.min(100, Math.round((state.received / file.bytes) * 100)) : 0;

    return (
        <section className="check" aria-labelledby={`${selectId}-title`} data-testid="check-copy">
            <h2 id={`${selectId}-title`} className="check__title">
                {messages.check_title}
            </h2>
            <p className="check__intro">{messages.check_intro}</p>

            {files.length > 1 ? (
                <div className="field">
                    <label htmlFor={selectId}>{messages.check_file}</label>
                    <select
                        id={selectId}
                        className="select"
                        value={selected}
                        onChange={(event) => {
                            setSelected(event.target.value);
                            setState({ status: 'idle' });
                            setConfirmedLarge(false);
                        }}
                    >
                        {files.map((candidate) => (
                            <option key={candidate.path} value={candidate.path}>
                                {candidate.path} ({candidate.sizeLabel})
                            </option>
                        ))}
                    </select>
                </div>
            ) : (
                <p className="check__file">
                    <code>{file.path}</code> <span className="muted">{file.sizeLabel}</span>
                </p>
            )}

            {isLarge ? (
                <div className="check__large">
                    <p>{messages.check_large.replace('{size}', file.sizeLabel)}</p>
                    <div className="check__actions">
                        <button type="button" className="btn" onClick={() => setConfirmedLarge(true)}>
                            {messages.check_large_anyway}
                        </button>
                        <button type="button" className="btn btn--quiet" onClick={copyHash}>
                            {copied ? messages.check_copied : messages.check_copy_hash}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="check__actions">
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={run}
                        disabled={state.status === 'running'}
                        data-testid="check-button"
                    >
                        {state.status === 'idle' ? messages.check_button : messages.check_again}
                    </button>
                </div>
            )}

            <div className="check__result" role="status" aria-live="polite" data-testid="check-result">
                {state.status === 'running' ? (
                    <div className="check__progress">
                        <p>{messages.check_running}</p>
                        <div className="check__bar" aria-hidden="true">
                            <span style={{ transform: `scaleX(${percent / 100})` }} />
                        </div>
                        <p className="muted">
                            {messages.check_progress
                                .replace('{done}', `${percent}%`)
                                .replace('{total}', file.sizeLabel)}
                        </p>
                    </div>
                ) : null}
                {state.status === 'verified' ? (
                    <p className="check__state check__state--ok" data-state="verified">
                        <span className="tag tag--in">{messages.check_tag_verified}</span> {messages.check_verified}
                    </p>
                ) : null}
                {state.status === 'mismatch' ? (
                    <p className="check__state check__state--bad" data-state="mismatch">
                        <span className="tag tag--out">{messages.check_tag_mismatch}</span> {messages.check_mismatch}
                    </p>
                ) : null}
                {state.status === 'failed' ? (
                    <p className="check__state" data-state="failed">
                        {messages.check_fetch_failed}
                    </p>
                ) : null}
            </div>

            <dl className="check__hashes">
                <dt>{messages.check_expected}</dt>
                <dd>
                    <code>{file.sha256}</code>
                </dd>
                {state.status === 'verified' || state.status === 'mismatch' ? (
                    <>
                        <dt>{messages.check_actual}</dt>
                        <dd>
                            <code data-testid="check-actual">{state.actual}</code>
                        </dd>
                    </>
                ) : null}
            </dl>
            <p className="check__self muted">{messages.check_self}</p>
        </section>
    );
}
