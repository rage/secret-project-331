import { gutenbergControlsHidden, gutenbergControlsVisible } from "../../src/styles/EditorStyles"

const APPENDER = ".block-editor-button-block-appender"

// Emotion inserts through insertRule in jsdom, so the rule text only exists in the CSSOM.
const appenderRuleFor = (className: string): string => {
  const rules = Array.from(document.styleSheets).flatMap((sheet) =>
    Array.from(sheet.cssRules).map((rule) => rule.cssText.replaceAll(/\s+/g, "")),
  )
  const rule = rules.find((text) => text.includes(`.${className}`) && text.includes(APPENDER))
  if (rule === undefined) {
    throw new Error(`emotion inserted no appender rule for ${className}`)
  }
  return rule
}

const classSelectorCount = (rule: string) => (rule.split("{", 1)[0]?.match(/\./g) ?? []).length

describe("gutenbergControls visibility classes", () => {
  const hidden = appenderRuleFor(gutenbergControlsHidden)
  const visible = appenderRuleFor(gutenbergControlsVisible)

  it("hides the appender", () => {
    expect(hidden).toContain("display:none!important")
  })

  it("shows the appender", () => {
    expect(visible).toContain("display:block!important")
  })

  // An appender inside both wrappers has to follow the inner, visible one. jsdom resolves that
  // conflict by document order and ignores specificity, so assert the selector rather than a
  // computed style: the extra class is what keeps the outcome independent of declaration order.
  it("lets the visible rule outrank the hidden one on specificity alone", () => {
    expect(classSelectorCount(visible)).toBeGreaterThan(classSelectorCount(hidden))
  })
})
