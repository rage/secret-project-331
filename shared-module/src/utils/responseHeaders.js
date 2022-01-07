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
    value: "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-src *",
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
    value: "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-src *; frame-ancestors *",
  },
]

module.exports = { normalResponseHeaders, externallyEmbeddableIFrameResponseHeaders }
