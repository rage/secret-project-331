import {
  spinnerGlyphCss,
  type SpinnerSize,
  type SpinnerTone,
} from "../src/components/primitives/spinnerStyles"

interface FlatRule {
  /** `undefined` for a rule outside any `@media` block. */
  condition?: string
  cssText: string
}

/** Every rule emotion has injected for this test file, with `@media` blocks flattened one level. */
function allRules(): FlatRule[] {
  const rules: FlatRule[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (rule instanceof CSSMediaRule) {
        for (const inner of Array.from(rule.cssRules)) {
          rules.push({ condition: rule.conditionText, cssText: inner.cssText })
        }
      } else {
        rules.push({ cssText: rule.cssText })
      }
    }
  }
  return rules
}

function ruleFor(className: string, condition?: string): string {
  const rule = allRules().find(
    (r) => r.cssText.includes(`.${className}`) && r.condition === condition,
  )
  if (!rule) {
    throw new Error(`No rule for .${className} under ${condition ?? "(no media)"}`)
  }
  return rule.cssText
}

const SIZES: Record<SpinnerSize, { diameterPx: number; strokePx: number }> = {
  sm: { diameterPx: 16, strokePx: 2 },
  md: { diameterPx: 20, strokePx: 2 },
  lg: { diameterPx: 24, strokePx: 3 },
}

const TONES: Record<SpinnerTone, string> = {
  accent: "var(--color-green-600)",
  current: "currentColor",
  inverse: "var(--color-clear-50)",
}

describe("spinnerGlyphCss", () => {
  test.each(Object.entries(SIZES))(
    "%s ring is %spx with a %spx stroke",
    (size, { diameterPx, strokePx }) => {
      const className = spinnerGlyphCss(size as SpinnerSize, "accent")
      const base = ruleFor(className)
      expect(base).toContain(`width: ${diameterPx}px`)
      expect(base).toContain(`height: ${diameterPx}px`)
      expect(base).toContain(`border: ${strokePx}px solid`)
    },
  )

  test.each(Object.entries(TONES))("%s tone colours the ring with %s", (tone, expectedColor) => {
    const className = spinnerGlyphCss("md", tone as SpinnerTone)
    const base = ruleFor(className)
    expect(base).toContain(`border: 2px solid ${expectedColor}`)
  })

  test("the ring has an open quadrant so it reads as a spinner, not a full circle", () => {
    const className = spinnerGlyphCss("md", "accent")
    expect(ruleFor(className)).toContain("border-right-color: transparent")
  })

  test("spins continuously via the shared duration and easing tokens", () => {
    const className = spinnerGlyphCss("md", "accent")
    const base = ruleFor(className)
    expect(base).toMatch(
      /animation: animation-\w+ var\(--duration-spin\) var\(--ease-linear\) infinite/,
    )
  })

  test("reduced motion swaps rotation for a two-step opacity pulse, not animation: none", () => {
    const className = spinnerGlyphCss("md", "accent")
    const base = ruleFor(className)
    const reduced = ruleFor(className, "(prefers-reduced-motion: reduce)")

    const baseAnimationName = /animation: (animation-\w+)/.exec(base)?.[1]
    const reducedAnimationName = /animation: (animation-\w+)/.exec(reduced)?.[1]
    expect(reducedAnimationName).toBeDefined()
    expect(reducedAnimationName).not.toBe(baseAnimationName)
    expect(reduced).toContain("steps(2, jump-none)")
    expect(reduced).toContain("var(--duration-slow)")
  })

  test("forced colors pins the arc to CanvasText and keeps the gap transparent", () => {
    const className = spinnerGlyphCss("md", "current")
    const forced = ruleFor(className, "(forced-colors: active)")
    expect(forced).toContain("border-color: CanvasText")
    expect(forced).toContain("border-right-color: transparent")
  })
})
