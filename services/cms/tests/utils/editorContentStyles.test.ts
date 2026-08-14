/**
 * @jest-environment jsdom
 */

import fs from "fs"
import { createRequire } from "module"
import path from "path"

import { headingFont, primaryFont } from "../../src/shared-module/common/styles"
import { editorContentStyles } from "../../src/utils/Gutenberg/editorContentStyles"

// transformStyles is not in @wordpress/block-editor's exports map, so it is reached by file path, the
// same way GutenbergEditor.tsx reaches format-library's build-style. The built file ships no type
// declarations, hence createRequire rather than an import.
const requireFromTest = createRequire(import.meta.url)
const transformStyles = requireFromTest(
  "../../node_modules/@wordpress/block-editor/build/utils/transform-styles/index.cjs",
).default as (
  styles: readonly { css: string }[],
  wrapperSelector: string,
  transformOptions?: { ignoredSelectors: RegExp[] },
) => (string | null)[]

// Must stay in sync with GutenbergEditor.tsx, which owns the values actually passed to EditorStyles.
const SCOPE = ":where(.editor-styles-wrapper)"
const TRANSFORM_OPTIONS = { ignoredSelectors: [/\.editor-styles-wrapper/gi] }

// Read off the filesystem, not resolved as a module: next/jest maps .css imports to a style mock.
const RESET_CSS_PATH = path.join(
  import.meta.dirname,
  "../../node_modules/@wordpress/block-library/build-style/reset.css",
)

interface Rule {
  selectors: string[]
  declarations: Record<string, string>
}

/** Parses declaration blocks. At-rule preludes are skipped, so rules inside media queries are included. */
const parseRules = (css: string): Rule[] => {
  const rules: Rule[] = []
  const withoutComments = css.replaceAll(/\/\*[\s\S]*?\*\//g, "")
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g
  let match = rulePattern.exec(withoutComments)
  while (match !== null) {
    const [, rawSelectors, body] = match
    const declarations: Record<string, string> = {}
    for (const declaration of (body ?? "").split(";")) {
      const separator = declaration.indexOf(":")
      if (separator === -1) {
        continue
      }
      declarations[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim()
    }
    rules.push({
      selectors: (rawSelectors ?? "")
        .split(",")
        .map((selector) => selector.trim())
        .filter((selector) => selector !== ""),
      declarations,
    })
    match = rulePattern.exec(withoutComments)
  }
  return rules
}

const findRule = (rules: Rule[], selector: string): Rule | undefined =>
  rules.find((rule) => rule.selectors.includes(selector))

const canvasCss = editorContentStyles[0]?.css ?? ""
const canvasRules = parseRules(canvasCss)
const canvasRootRule = findRule(canvasRules, "body")

describe("editorContentStyles shape", () => {
  it("matches the array of { css } objects that settings.styles accepts", () => {
    expect(Array.isArray(editorContentStyles)).toBe(true)
    expect(editorContentStyles.length).toBeGreaterThan(0)
    for (const style of editorContentStyles) {
      expect(typeof style.css).toBe("string")
      expect(style.css.trim().length).toBeGreaterThan(0)
    }
  })
})

describe("canvas typography", () => {
  it("sets the canvas body font to Inter Variable via the primaryFont token", () => {
    expect(primaryFont).toMatch(/^"Inter Variable",\s*Inter,/)
    expect(canvasRootRule?.declarations["font-family"]).toBe(primaryFont)
  })

  it("sets headings to the separate headingFont token, as GlobalStyles does", () => {
    const headingRule = findRule(canvasRules, "body h1")
    expect(headingRule?.declarations["font-family"]).toBe(headingFont)
    expect(headingFont).not.toBe(primaryFont)
  })
})

describe("pairing with block-library's canvas reset", () => {
  // reset.css reverts the canvas toward browser defaults, so anything it reverts and we do not
  // restore lands on a browser default. Its font-family revert is what turns the canvas serif.
  const resetRootRule = findRule(
    parseRules(fs.readFileSync(RESET_CSS_PATH, "utf8")),
    "html :where(.editor-styles-wrapper)",
  )
  // The reset paints the canvas white; we deliberately leave that to it.
  const NOT_OUR_JOB = ["background"]

  it("reverts the canvas font to serif, which is why our styles must restore it", () => {
    expect(resetRootRule?.declarations["font-family"]).toBe("serif")
    expect(canvasRootRule?.declarations["font-family"]).not.toBe("serif")
  })

  it("restores every canvas root property the reset reverts", () => {
    const reverted = Object.keys(resetRootRule?.declarations ?? {}).filter(
      (property) => !NOT_OUR_JOB.includes(property),
    )
    expect(reverted).not.toHaveLength(0)
    for (const property of reverted) {
      expect(canvasRootRule?.declarations).toHaveProperty(property)
    }
  })
})

describe("scoping through Gutenberg's transformStyles", () => {
  const transformed = transformStyles(editorContentStyles, SCOPE, TRANSFORM_OPTIONS)[0]

  it("parses without a postcss error", () => {
    expect(typeof transformed).toBe("string")
  })

  it("scopes every selector to the editor canvas", () => {
    const selectors = parseRules(transformed ?? "").flatMap((rule) => rule.selectors)
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain(".editor-styles-wrapper")
    }
  })

  it("rewrites body selectors instead of leaking them to the surrounding CMS UI", () => {
    expect(transformed).toContain(`body ${SCOPE}`)
    expect(transformed).not.toMatch(/(^|})\s*body\s*[,{]/)
  })

  it("keeps the repeated scope class unprefixed so it outranks a single class selector", () => {
    const scopeClassRule = findRule(parseRules(transformed ?? ""), ".editor-styles-wrapper")
    expect(scopeClassRule?.declarations["font-family"]).toBe(primaryFont)
  })

  it("keeps the responsive paragraph size inside its media query", () => {
    expect(transformed).toContain("@media (min-width: 48rem)")
  })
})
