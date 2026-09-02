import { atLeast, below, BREAKPOINT_PX } from "../src/styles/breakpoints"
import {
  DURATION_MS,
  EASING,
  LOADING_AFFORDANCE_DELAY_MS,
  LOOP_DURATION_MS,
  MIN_VISIBLE_MS,
} from "../src/styles/motion"
import "../src/styles/tokens"

/** The `:root` declaration block that `tokensGlobal` injects, as a live `CSSStyleDeclaration`. */
function rootDeclarations(): CSSStyleDeclaration {
  const sheet = document.styleSheets[0]
  const rule = sheet && Array.from(sheet.cssRules).find((r) => r.cssText.startsWith(":root"))
  if (!(rule instanceof CSSStyleRule)) {
    throw new Error("tokensGlobal did not inject a :root rule")
  }
  return rule.style
}

describe("breakpoints", () => {
  test("exports the five steps", () => {
    expect(BREAKPOINT_PX).toEqual({ xs: 480, sm: 576, md: 768, lg: 992, xl: 1200 })
  })

  test("atLeast matches from the boundary width up", () => {
    expect(atLeast("md")).toBe("@media (min-width: 768px)")
  })

  test("below guards the boundary width so it never overlaps atLeast", () => {
    expect(below("md")).toBe("@media (max-width: 767.98px)")
  })

  test("every step's below() stays under its own width", () => {
    for (const bp of Object.keys(BREAKPOINT_PX) as (keyof typeof BREAKPOINT_PX)[]) {
      const belowMax = Number(/max-width: ([\d.]+)px/.exec(below(bp))![1])
      expect(belowMax).toBe(BREAKPOINT_PX[bp] - 0.02)
    }
  })
})

describe("motion", () => {
  test("exports the duration scale", () => {
    expect(DURATION_MS).toEqual({ instant: 80, fast: 140, base: 200, slow: 280, deliberate: 360 })
  })

  test("exports the loop durations", () => {
    expect(LOOP_DURATION_MS).toEqual({ spin: 900, shimmer: 1600, progressBeam: 1100 })
  })

  test("exports the easing curves", () => {
    expect(EASING).toEqual({
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      entrance: "cubic-bezier(0.05, 0.7, 0.1, 1)",
      exit: "cubic-bezier(0.3, 0, 0.8, 0.15)",
      linear: "linear",
    })
  })

  test("exports the loading affordance timing constants", () => {
    expect(LOADING_AFFORDANCE_DELAY_MS).toBe(250)
    expect(MIN_VISIBLE_MS).toBe(400)
  })
})

describe("tokens.ts custom properties", () => {
  test("radii scale, with --control-radius aliased onto it", () => {
    const root = rootDeclarations()
    expect(root.getPropertyValue("--radius-0")).toBe("0px")
    expect(root.getPropertyValue("--radius-1")).toBe("4px")
    expect(root.getPropertyValue("--radius-2")).toBe("6px")
    expect(root.getPropertyValue("--radius-3")).toBe("8px")
    expect(root.getPropertyValue("--radius-4")).toBe("12px")
    expect(root.getPropertyValue("--radius-5")).toBe("16px")
    expect(root.getPropertyValue("--radius-full")).toBe("9999px")
    expect(root.getPropertyValue("--control-radius")).toBe("var(--radius-2)")
  })

  test("elevation scale is neutral and two-layered, plus the pressed inset and scrim", () => {
    const root = rootDeclarations()
    expect(root.getPropertyValue("--shadow-rgb")).toBe("10 15 23")
    expect(root.getPropertyValue("--elevation-0")).toBe("none")
    for (const step of [1, 2, 3, 4]) {
      const layers = root.getPropertyValue(`--elevation-${step}`).split("),")
      expect(layers).toHaveLength(2)
      for (const layer of layers) {
        expect(layer).toContain("rgb(var(--shadow-rgb)")
      }
    }
    expect(root.getPropertyValue("--elevation-inset-pressed")).toContain("inset")
    expect(root.getPropertyValue("--scrim")).toBe("rgb(var(--shadow-rgb) / 0.55)")
  })

  test("layering scale", () => {
    const root = rootDeclarations()
    expect(root.getPropertyValue("--layer-below")).toBe("-1")
    expect(root.getPropertyValue("--layer-base")).toBe("0")
    expect(root.getPropertyValue("--layer-raised")).toBe("1")
    expect(root.getPropertyValue("--layer-sticky")).toBe("100")
    expect(root.getPropertyValue("--layer-overlay")).toBe("1000")
    expect(root.getPropertyValue("--layer-toast")).toBe("1100")
  })

  test("motion custom properties are interpolated from motion.ts, not a separate copy", () => {
    const root = rootDeclarations()
    expect(root.getPropertyValue("--duration-instant")).toBe(`${DURATION_MS.instant}ms`)
    expect(root.getPropertyValue("--duration-fast")).toBe(`${DURATION_MS.fast}ms`)
    expect(root.getPropertyValue("--duration-base")).toBe(`${DURATION_MS.base}ms`)
    expect(root.getPropertyValue("--duration-slow")).toBe(`${DURATION_MS.slow}ms`)
    expect(root.getPropertyValue("--duration-deliberate")).toBe(`${DURATION_MS.deliberate}ms`)
    expect(root.getPropertyValue("--duration-spin")).toBe(`${LOOP_DURATION_MS.spin}ms`)
    expect(root.getPropertyValue("--duration-shimmer")).toBe(`${LOOP_DURATION_MS.shimmer}ms`)
    expect(root.getPropertyValue("--duration-progress-beam")).toBe(
      `${LOOP_DURATION_MS.progressBeam}ms`,
    )
    expect(root.getPropertyValue("--ease-standard")).toBe(EASING.standard)
    expect(root.getPropertyValue("--ease-entrance")).toBe(EASING.entrance)
    expect(root.getPropertyValue("--ease-exit")).toBe(EASING.exit)
    expect(root.getPropertyValue("--ease-linear")).toBe(EASING.linear)
  })

  test("exit durations run at 70% of their entrance duration", () => {
    const root = rootDeclarations()
    expect(root.getPropertyValue("--duration-exit")).toBe("calc(var(--duration-base) * 0.7)")
    expect(root.getPropertyValue("--duration-exit-slow")).toBe("calc(var(--duration-slow) * 0.7)")
    expect(root.getPropertyValue("--duration-exit-deliberate")).toBe(
      "calc(var(--duration-deliberate) * 0.7)",
    )
  })

  test("font stacks lead with the package's face and share one system fallback", () => {
    const root = rootDeclarations()
    const sansStack = root.getPropertyValue("--font-sans").split(",")
    const headingStack = root.getPropertyValue("--font-heading").split(",")
    const monoStack = root.getPropertyValue("--font-mono").split(",")

    expect(sansStack[0]).toBe('"Inter Variable"')
    expect(headingStack[0]).toBe("Raleway")
    expect(monoStack[0]).toBe('"Space Mono"')

    // Heading only swaps the lead face; everything from system-ui onward matches --font-sans,
    // so the two stacks degrade identically once neither Inter nor Raleway is available.
    expect(headingStack.slice(1)).toEqual(sansStack.slice(2))
  })
})
