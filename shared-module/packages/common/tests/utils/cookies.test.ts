import { getValueFromCookieString } from "../../src/utils/cookies"

describe("cookies getValueFromCookieString", () => {
  test("it works", () => {
    expect(getValueFromCookieString("a=aaa; b=bbbb", "a")).toBe("aaa")
    expect(getValueFromCookieString("a=aaa; b=bbbb", "b")).toBe("bbbb")
    expect(getValueFromCookieString("a=aaa; b=bbbb", "c")).toBe(null)
  })
})
