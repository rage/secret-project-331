import { richTextToPlainText } from "../richTextToPlainText"

describe("richTextToPlainText", () => {
  it.each([
    ["Tom &amp; Jerry.pdf", "Tom & Jerry.pdf"],
    ["<strong>Week</strong> 1 &lt;draft&gt;", "Week 1 <draft>"],
    ["10&nbsp;km &#169; &#x263A;", "10 km © ☺"],
    ["&unknown; &#0; &#x110000;", "&unknown; &#0; &#x110000;"],
    ["  spaced  ", "spaced"],
  ])("turns %j into %j", (html, text) => {
    expect(richTextToPlainText(html)).toBe(text)
  })
})
