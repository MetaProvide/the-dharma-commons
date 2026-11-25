// @ts-check
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://thedharmacommons.org',
    output: 'static',
    trailingSlash: 'ignore',
    i18n: {
        locales: ['en'],
        defaultLocale: 'en',
        routing: { prefixDefaultLocale: false },
    },
    integrations: [react(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
});
