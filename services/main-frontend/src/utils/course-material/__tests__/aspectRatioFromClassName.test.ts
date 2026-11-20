import aspectRatioFromClassName from "../aspectRatioFromClassName"

describe("aspectRatioFromClassName", () => {
  it("defaults to 16 / 9 without an aspect class", () => {
    expect(aspectRatioFromClassName(undefined)).toBe("16 / 9")
    expect(aspectRatioFromClassName("")).toBe("16 / 9")
    expect(aspectRatioFromClassName("wp-has-aspect-ratio")).toBe("16 / 9")
  })

  it("reads the aspect class", () => {
    expect(aspectRatioFromClassName("wp-embed-aspect-4-3 wp-has-aspect-ratio")).toBe("4 / 3")
    expect(aspectRatioFromClassName("wp-embed-aspect-9-16")).toBe("9 / 16")
  })
})
