/* eslint-disable i18next/no-literal-string */

/**
 * @param {{requireTrustedTypesFor: boolean}} options
 */
function generateNormalResponseHeaders(options = { requireTrustedTypesFor: false }) {
  return [
    {
      key: "Referrer-Policy",
      value: "no-referrer-when-downgrade",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },

    {
      key: "Permissions-Policy",
      value: `fullscreen=(self "https://www.thinglink.com")`,
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'none'",
        "connect-src 'self' https://vimeo.com/api/oembed.json *",
        "font-src 'self'",
        "frame-src * data: blob:",
        "img-src 'self' data: blob: https://storage.googleapis.com abs.twimg.com https://pbs.twimg.com ton.twimg.com platform.twitter.com",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' data: blob: https://cdn.syndication.twimg.com platform.twitter.com",
        "style-src 'self' 'unsafe-inline' https://ton.twimg.com platform.twitter.com",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "prefetch-src 'self'",
        "media-src 'self' https://storage.googleapis.com",
        // Forces us to sanitize html before using dangerouslySetInnerHTML. Please see: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/require-trusted-types-for
        options.requireTrustedTypesFor && "require-trusted-types-for 'script'",
      ]
        .filter((o) => !!o)
        .join("; "),
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "X-XSS-Protection",
      value: "1; mode=block",
    },
  ]
}
// Mostly allows the page to be embedded in an iframe
const externallyEmbeddableIFrameResponseHeaders = [
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },

  {
    key: "Permissions-Policy",
    value: "fullscreen=(self)",
  },
  {
    key: "Content-Security-Policy",
    // Permissive because of this Safari bug: https://bugs.webkit.org/show_bug.cgi?id=223848
    // Should be ok because the iframes are sandboxed
    value: "default-src * 'self' data: 'unsafe-inline' 'unsafe-eval'", // "default-src 'self'; connect-src 'self'; font-src 'self'; frame-src *; img-src 'self' data: blob: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Access-Control-Allow-Private-Network",
    value: "true",
  },
  // This application is meant to be used with a sandboxed iframe.
  // That causes that we need cors headers some for some resrouces like api routes, fonts, development files etc.
  // It's best to enable all origins for all files since it should be fine to make requests to the services from anywhere.
  { key: "Access-Control-Allow-Origin", value: "*" },
]

module.exports = { generateNormalResponseHeaders, externallyEmbeddableIFrameResponseHeaders }
