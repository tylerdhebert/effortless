import esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['cli/efl.ts'],
  outfile: 'dist-cli/efl.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: ['better-sqlite3'],
  sourcemap: false,
  logLevel: 'info',
})
