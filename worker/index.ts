/**
 * Serves the static site from Workers static assets and sends every other hostname
 * (www., dharmacommons.com) to the one canonical address with a permanent redirect.
 */
interface Env {
    ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const canonicalHost = 'dharmacommons.org';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const isPreview = url.hostname.endsWith('.workers.dev') || url.hostname === 'localhost';
        if (url.hostname !== canonicalHost && !isPreview) {
            url.hostname = canonicalHost;
            url.protocol = 'https:';
            url.port = '';
            return Response.redirect(url.toString(), 301);
        }
        return env.ASSETS.fetch(request);
    },
};
