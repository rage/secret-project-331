// CommonJS stand-in for the `uuid` package in Jest.
//
// uuid v14 ships as ESM only, and next/jest's transformIgnorePatterns do not allow it through the
// transformer, so importing it in a test crashes with "Unexpected token 'export'". This mock
// provides faithful implementations of the two entry points used in this service (`validate` and
// `v4`) so tests that transitively import `uuid` (e.g. via shared-module `strings.ts`) run.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validate(value) {
  return typeof value === "string" && UUID_RE.test(value)
}

function v4() {
  // RFC 4122 version-4 UUID. Uses Math.random, which is sufficient for test fixtures.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

module.exports = { validate, v4 }
