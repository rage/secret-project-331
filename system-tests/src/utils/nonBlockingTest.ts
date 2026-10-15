/**
 * A non-blocking variant of the suite's `test`, for specs still earning trust after repeated CI
 * flakiness: a thrown error or failed assertion inside a test body is caught and logged rather than
 * failing the test, so a genuine bug in these specs does not turn CI red before enough runs have
 * proven the test itself reliable.
 *
 * Only wraps the test body. `beforeEach`/`afterEach` and fixture setup run outside this wrapper's
 * reach and still fail normally — Playwright's own lifecycle, not this layer, owns those. `expect.soft`
 * is also unprotected: its failures are accumulated by Playwright rather than thrown out of the body.
 */

import { expect, test as base } from "./fixtures"

export { ADMIN_STORAGE_STATE } from "./fixtures"
export { expect }

type TestBody = (...args: unknown[]) => unknown

/**
 * Playwright reads which fixtures a test needs by regex-matching the test function's own
 * `toString()`, requiring the first parameter's source text to look like `{ ... }`. A generic
 * `(...args) =>` wrapper hides that pattern and Playwright rejects every test with "First argument
 * must use the object destructuring pattern". `new Function` rebuilds a wrapper whose source text
 * carries the original parameter list, so the regex still matches; `arguments` forwards the real
 * values regardless of how they're destructured.
 */
const nonBlocking = (body: TestBody): TestBody => {
  const paramsMatch = body.toString().match(/(?:async)?(?:\s+function)?[^(]*\(([^)]*)/)
  const params = paramsMatch?.[1] ?? ""
  // oxlint-disable-next-line no-new-func -- only way to preserve the fixture-destructuring source text
  const wrapped = new Function(
    "body",
    "onError",
    `return async function (${params}) {
      try {
        return await body.apply(this, arguments)
      } catch (error) {
        onError(error)
      }
    }`,
  ) as (innerBody: TestBody, onError: (error: unknown) => void) => TestBody
  return wrapped(body, (error) => console.error("Non-blocking test failed:", error))
}

export const testThatCanFail = new Proxy(base, {
  apply(target, thisArg, args) {
    const [title, detailsOrBody, maybeBody] = args as [string, TestBody | object, TestBody?]
    if (typeof detailsOrBody === "function") {
      return Reflect.apply(target, thisArg, [title, nonBlocking(detailsOrBody as TestBody)])
    }
    return Reflect.apply(target, thisArg, [
      title,
      detailsOrBody,
      nonBlocking(maybeBody as TestBody),
    ])
  },
}) as typeof base
