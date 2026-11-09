import { validateReturnToRouteOrDefault } from "../redirectBackAfterLoginOrSignup"

describe("validateReturnToRouteOrDefault", () => {
  it("keeps a same-site path", () => {
    expect(validateReturnToRouteOrDefault("/org/uh-cs/courses/x?a=1#b", "/")).toBe(
      "/org/uh-cs/courses/x?a=1#b",
    )
  })

  it.each(["//evil.com", "/.//evil.com", "/./\\evil.com", "/%2e//evil.com", "https://evil.com//x"])(
    "refuses %s, which would leave the site",
    (returnTo) => {
      expect(validateReturnToRouteOrDefault(returnTo, "/")).not.toMatch(/^[/\\]{2}/)
    },
  )
})
