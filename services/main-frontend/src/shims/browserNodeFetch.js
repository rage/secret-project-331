// @citation-js/core statically imports node-fetch even though it only calls it
// outside the browser (see its isBrowser ternary in fetchFile.js). node-fetch
// transitively requires node:fs/node:net via fetch-blob, which Turbopack
// refuses to bundle for the client ("chunking context does not support
// external modules"). Aliased in for the browser via next.config.js
// turbopack.resolveAlias; the global fetch/Headers are what citation-js would
// have used in the browser anyway.
export default globalThis.fetch
export const Headers = globalThis.Headers
