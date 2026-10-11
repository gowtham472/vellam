/**
 * Bundles each Lambda handler into dist/handlers/<name>/index.mjs. The AWS SDK is left out
 * because the Node.js 22 runtime already provides it, which keeps the packages small.
 */
import { rmSync } from 'node:fs';
import { build } from 'esbuild';

const HANDLERS = ['api', 'snapshot'];

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true });

for (const name of HANDLERS) {
  await build({
    entryPoints: [new URL(`../src/api/handlers/${name}.ts`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    outfile: new URL(`../dist/handlers/${name}/index.mjs`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: true,
    minify: true,
    external: ['@aws-sdk/*'],
  });
  console.log(`built ${name}`);
}
