import { parseText } from "../src/components/ContentRenderer/util/textParsing"

/* eslint-disable i18next/no-literal-string */
describe("parseText", () => {
  test("Does not remove spaces in middle of sentences.", () => {
    const { parsedText } = parseText("a     a", [])
    expect(parsedText).toEqual("a     a")
  })
})
