// HTTP headers that let this app be embedded in a sandboxed, cross-origin iframe. Stamped on every
// production response by server.mjs, and fed to the dev server by rsbuild.config.ts. The permissive
// CSP is safe because the iframe sandbox provides the isolation.
export const IFRAME_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "Permissions-Policy": "fullscreen=(self)",
  "Content-Security-Policy":
    "default-src * 'self' data: 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:",
  "X-XSS-Protection": "1; mode=block",
  "Access-Control-Allow-Private-Network": "true",
  // Cross-origin iframe: API routes, fonts and assets need permissive CORS.
  "Access-Control-Allow-Origin": "*",
}
