// CommonJS stand-in for the `uuid` package in Jest.
//
// uuid v14 is ESM-only and next/jest's transformIgnorePatterns don't transform it, so importing it
// in a test crashes with "Unexpected token 'export'". Reimplements the two entry points this service
// uses (`validate`, `v4`) so tests that transitively import `uuid` (e.g. via shared-module
// `strings.ts`) run.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validate(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

function v4() {
  // RFC 4122 version-4 UUID. Uses Math.random, which is sufficient for test fixtures.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replaceAll(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16)
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

module.exports = { validate, v4 }
