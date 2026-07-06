// Single source of truth for the HTTP response headers that let this app be embedded in a
// sandboxed, cross-origin iframe. Byte-identical to the old next.config.js
// `externallyEmbeddableIFrameResponseHeaders`.
//
// Used in two places:
//   - server.mjs stamps these on every production response (incl. static assets / fonts).
//   - rsbuild.config.ts feeds them to the dev server (`server.headers`) so the dev cluster's
//     cross-origin iframe works the same as production.
//
// Permissive CSP is intentional: the iframe is sandboxed, which provides the isolation.
export const IFRAME_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "fullscreen=(self)",
  "Content-Security-Policy":
    "default-src * 'self' data: 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:",
  "X-XSS-Protection": "1; mode=block",
  "Access-Control-Allow-Private-Network": "true",
  // The app runs inside a sandboxed iframe whose origin differs from the parent, so API routes,
  // fonts and assets need permissive CORS.
  "Access-Control-Allow-Origin": "*",
}
