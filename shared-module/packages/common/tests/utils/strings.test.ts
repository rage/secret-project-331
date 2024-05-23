/* eslint-disable i18next/no-literal-string */
import { formatIETFLanguageTagWithRegion } from "../../src/utils/strings"

describe("formatIETFLanguageTagWithRegion util", () => {
  test("validates language subtag", () => {
    expect(() => formatIETFLanguageTagWithRegion("", undefined, "FI")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("f1", undefined, "FI")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("fiii", undefined, "FI")).toThrow()
    expect(formatIETFLanguageTagWithRegion("fi", undefined, "FI")).toBe("fi-FI")
    expect(formatIETFLanguageTagWithRegion("fi", undefined, "fi", "_")).toBe("fi_FI")
  })

  test("validates script subtag", () => {
    expect(() => formatIETFLanguageTagWithRegion("iu", "", "CA")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("iu", "C4ns", "CA")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("iu", "Canss", "CA")).toThrow()
    expect(formatIETFLanguageTagWithRegion("iu", "Cans", "CA")).toBe("iu-Cans-CA")
    expect(formatIETFLanguageTagWithRegion("iu", "cans", "ca", "_")).toBe("iu_Cans_CA")
  })

  test("validates region subtag", () => {
    expect(() => formatIETFLanguageTagWithRegion("en", undefined, "")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("en", undefined, "U5")).toThrow()
    expect(() => formatIETFLanguageTagWithRegion("en", undefined, "USS")).toThrow()
    expect(formatIETFLanguageTagWithRegion("en", undefined, "US")).toBe("en-US")
    expect(formatIETFLanguageTagWithRegion("en", undefined, "us", "_")).toBe("en_US")
  })
})
