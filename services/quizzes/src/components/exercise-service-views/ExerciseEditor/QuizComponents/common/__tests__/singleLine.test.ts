import { toSingleLine } from "../singleLine"

describe("toSingleLine", () => {
  it("returns text without line breaks unchanged", () => {
    expect(toSingleLine("just one line")).toBe("just one line")
  })

  it("returns an empty string unchanged", () => {
    expect(toSingleLine("")).toBe("")
  })

  it.each([
    ["a\nb", "a b"],
    ["a\r\nb", "a b"],
    ["a\rb", "a b"],
  ])("replaces a single %j break with a space", (input, expected) => {
    expect(toSingleLine(input)).toBe(expected)
  })

  it("collapses a run of consecutive breaks into a single space", () => {
    expect(toSingleLine("a\n\n\nb")).toBe("a b")
    expect(toSingleLine("a\r\n\r\nb")).toBe("a b")
  })

  it("handles breaks at the start and end of the string", () => {
    expect(toSingleLine("\nstart")).toBe(" start")
    expect(toSingleLine("end\n")).toBe("end ")
    expect(toSingleLine("\n\nboth\n\n")).toBe(" both ")
  })

  it("collapses a string made only of breaks into a single space", () => {
    expect(toSingleLine("\n\r\n\r")).toBe(" ")
  })

  it("preserves tabs and existing spaces", () => {
    expect(toSingleLine("a\tb  c")).toBe("a\tb  c")
    expect(toSingleLine("a \n b")).toBe("a   b")
  })

  it("collapses several separate breaks across a longer string", () => {
    expect(toSingleLine("one\ntwo\nthree")).toBe("one two three")
  })

  it("keeps a complete markdown block on one line (no inner breaks)", () => {
    expect(toSingleLine("[markdown]a\n\nb[/markdown]")).toBe("[markdown]a b[/markdown]")
  })
})
