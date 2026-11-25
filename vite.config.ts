import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function inlineCssPlugin(): Plugin {
  return {
    name: 'inline-built-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (!htmlAsset || htmlAsset.type !== 'asset' || typeof htmlAsset.source !== 'string') {
        return;
      }

      let html = htmlAsset.source;
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (!fileName.endsWith('.css') || chunk.type !== 'asset') continue;

        const cssText =
          typeof chunk.source === 'string'
            ? chunk.source
            : Array.from(chunk.source, (b) => String.fromCharCode(b)).join('');
        const safeCss = cssText.replace(/<\/style/gi, '<\\/style');
        const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const linkRegex = new RegExp(
          `<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']*${escapedName}["'][^>]*>`,
          'i'
        );

        if (linkRegex.test(html)) {
          html = html.replace(linkRegex, () => `<style>${safeCss}</style>`);
          delete bundle[fileName];
        }
      }
      htmlAsset.source = html;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), inlineCssPlugin()],
});
