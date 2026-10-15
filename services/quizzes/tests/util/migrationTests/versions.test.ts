import { detectQuizVersion } from "../../../src/util/migration/versions"

describe("detectQuizVersion", () => {
  test("a blob with no version field is the v1 (old quiz) format", () => {
    expect(detectQuizVersion({ items: [] })).toBe("1")
  })

  test.each(["1", "2", "3", "4"])("passes the known version string %s through", (version) => {
    expect(detectQuizVersion({ version })).toBe(version)
  })

  // Hostile / malformed values must fail loud here rather than dispatching into the registries.
  test.each([
    ["a numeric version", { version: 4 }],
    ["an unknown string version", { version: "99" }],
    ["a null version", { version: null }],
    ["a prototype-chain key", { version: "__proto__" }],
    ["a prototype-chain key", { version: "constructor" }],
  ])("throws on %s", (_label, blob) => {
    expect(() => detectQuizVersion(blob)).toThrow(/malformed quiz blob: unsupported version/i)
  })
})
