/* eslint-disable i18next/no-literal-string */
const normalResponseHeaders = [
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
    value: "fullscreen=(self)",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net; frame-src *; img-src 'self' data: blob: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
]
// Mostly allows the page to be embedded in an iframe
const externallyEmbeddableIFrameResponseHeaders = [
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
    value: "fullscreen=(self)",
  },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net; frame-src *; img-src 'self' data: blob: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'",
  },
]

module.exports = { normalResponseHeaders, externallyEmbeddableIFrameResponseHeaders }
