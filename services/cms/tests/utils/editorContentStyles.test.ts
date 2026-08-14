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
const EDITOR_STYLES_SCSS_PATH = path.join(
  import.meta.dirname,
  "../../src/styles/Gutenberg/editor-styles.scss",
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

/** Both maps below key the canvas root as `body`, and everything else by its element name. */
const CONTENT_ELEMENT_SELECTOR = /^(?:body|\.editor-styles-wrapper)(?: ([a-z][a-z0-9]*))?$/
const ELEMENT_SELECTOR_LIST = /^[a-z][a-z0-9]*(?:\s*,\s*[a-z][a-z0-9]*)*$/

type PropertiesByElement = Map<string, Set<string>>

const addProperty = (properties: PropertiesByElement, element: string, property: string): void => {
  const declared = properties.get(element) ?? new Set<string>()
  declared.add(property)
  properties.set(element, declared)
}

const canvasPropertiesByElement = (): PropertiesByElement => {
  const properties: PropertiesByElement = new Map()
  for (const rule of canvasRules) {
    for (const selector of rule.selectors) {
      const match = CONTENT_ELEMENT_SELECTOR.exec(selector)
      if (match === null) {
        continue
      }
      for (const property of Object.keys(rule.declarations)) {
        addProperty(properties, match[1] ?? "body", property)
      }
    }
  }
  return properties
}

/** Body of `selector`'s rule, brace-matched so nested rules come along. */
const nestedRuleBody = (scss: string, selector: string): string => {
  const opening = scss.indexOf(`${selector} {`)
  if (opening === -1) {
    throw new Error(`${selector} has no rule in editor-styles.scss`)
  }
  let depth = 0
  for (let index = opening; index < scss.length; index += 1) {
    if (scss[index] === "{") {
      depth += 1
    } else if (scss[index] === "}") {
      depth -= 1
      if (depth === 0) {
        return scss.slice(scss.indexOf("{", opening) + 1, index)
      }
    }
  }
  throw new Error(`${selector} is never closed in editor-styles.scss`)
}

/**
 * What editor-styles.scss declares on the canvas root (keyed `body`) and on the plain element
 * selectors nested inside it. Nested selectors carrying a class, attribute or pseudo are Gutenberg's
 * own chrome rendered inside the canvas, which shares no properties with content typography.
 */
const scssCanvasPropertiesByElement = (): PropertiesByElement => {
  const properties: PropertiesByElement = new Map()
  const walk = (body: string, element: string): void => {
    let buffer = ""
    let index = 0
    while (index < body.length) {
      const character = body[index]
      if (character === "{") {
        let depth = 1
        const start = index + 1
        while (depth > 0) {
          index += 1
          if (body[index] === "{") {
            depth += 1
          } else if (body[index] === "}") {
            depth -= 1
          }
        }
        const selector = buffer.trim()
        if (ELEMENT_SELECTOR_LIST.test(selector)) {
          for (const part of selector.split(",")) {
            walk(body.slice(start, index), part.trim())
          }
        }
        buffer = ""
      } else if (character === ";") {
        const property = buffer.split(":")[0]?.trim() ?? ""
        if (/^[a-z-]+$/.test(property)) {
          addProperty(properties, element, property)
        }
        buffer = ""
      } else {
        buffer += character
      }
      index += 1
    }
  }
  const scss = fs
    .readFileSync(EDITOR_STYLES_SCSS_PATH, "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/(^|\s)\/\/[^\n]*/g, "$1")
  walk(nestedRuleBody(scss, ".editor-styles-wrapper"), "body")
  return properties
}

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

// Asserted as non-overlap rather than as a computed style: jsdom resolves the cascade by document
// order and ignores specificity, so it cannot say which of two competing declarations wins.
describe("single ownership of canvas content typography", () => {
  const canvasProperties = canvasPropertiesByElement()
  const scssProperties = scssCanvasPropertiesByElement()

  it("reads declarations out of both stylesheets", () => {
    expect(canvasProperties.get("p")).toContain("font-size")
    expect(scssProperties.get("img")).toContain("max-width")
  })

  it.each([...canvasProperties.keys()].toSorted())(
    "editor-styles.scss leaves the %s properties to editorContentStyles",
    (element) => {
      const shadowed = [...(scssProperties.get(element) ?? [])].filter((property) =>
        canvasProperties.get(element)?.has(property),
      )

      expect(shadowed).toEqual([])
    },
  )
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
