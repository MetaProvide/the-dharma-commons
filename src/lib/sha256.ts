/**
 * SHA-256 of some bytes as lowercase hex, using the browser's (or Node's) Web Crypto.
 */
export async function sha256Hex(data: BufferSource): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
