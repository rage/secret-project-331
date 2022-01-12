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
  //  default-src 'none'; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net; frame-src 'self'; img-src 'self' data: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/base/worker/workerMain.js https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/editor/editor.main.js https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/editor/editor.main.nls.js https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/language/json/jsonMode.js https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/language/json/jsonWorker.js https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/loader.js; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor@0.28.1/min/vs/editor/
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net; frame-src *; img-src 'self' data: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor*; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor*",
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
      "default-src 'self'; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net; frame-src *; img-src 'self' data: https://storage.googleapis.com; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor*; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net/npm/monaco-editor*",
  },
]

module.exports = { normalResponseHeaders, externallyEmbeddableIFrameResponseHeaders }
