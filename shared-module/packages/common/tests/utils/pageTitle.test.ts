import { DEFAULT_SITE_NAME, formatPageTitle } from "../../src/utils/pageTitle"

describe("formatPageTitle util", () => {
  const SITE = "Example Site"

  test("appends the site name to a page title", () => {
    expect(formatPageTitle("Settings", SITE)).toBe("Settings - Example Site")
  })

  test("returns the site name alone for blank, null or undefined titles", () => {
    expect(formatPageTitle(null, SITE)).toBe(SITE)
    expect(formatPageTitle(undefined, SITE)).toBe(SITE)
    expect(formatPageTitle("", SITE)).toBe(SITE)
    expect(formatPageTitle("   ", SITE)).toBe(SITE)
  })

  test("trims the page title before formatting", () => {
    expect(formatPageTitle("  Dashboard  ", SITE)).toBe("Dashboard - Example Site")
  })

  test("supports a custom separator", () => {
    expect(formatPageTitle("Course", SITE, " | ")).toBe("Course | Example Site")
  })
})

describe("DEFAULT_SITE_NAME", () => {
  test("is a non-empty string (falls back to the project name without an env override)", () => {
    expect(typeof DEFAULT_SITE_NAME).toBe("string")
    expect(DEFAULT_SITE_NAME.length).toBeGreaterThan(0)
  })
})
