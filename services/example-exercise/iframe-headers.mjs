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
  // The Playground POSTs JSON to the spec endpoints from the browser, which needs a preflight.
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
}

/**
 * Answers a CORS preflight (`OPTIONS`) with `204` and the iframe headers.
 *
 * Must run before routing: an unanswered `OPTIONS` reaches the SPA shell or the dev server's own
 * CORS middleware, neither of which allows a foreign origin, so the browser blocks the request.
 *
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @returns {boolean} whether the request was a preflight and has been answered
 */
export function answerPreflight(req, res) {
  if (req.method !== "OPTIONS") {
    return false
  }
  res.writeHead(204, IFRAME_HEADERS)
  res.end()
  return true
}
