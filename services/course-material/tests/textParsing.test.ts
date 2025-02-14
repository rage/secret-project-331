import { parseText } from "../src/components/ContentRenderer/util/textParsing"

describe("parseText", () => {
  test("Does not remove spaces in middle of sentences.", () => {
    const { parsedText } = parseText("a     a", [])
    expect(parsedText).toBe("a     a")
  })
})
