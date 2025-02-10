import { roundDown } from "../../src/utils/numbers"

describe("roundDown", () => {
  test("rounds down simple case", () => {
    expect(roundDown(1.1199, 2)).toEqual("1.11")
  })

  test("rounds down and cuts off unnecessary zeros", () => {
    expect(roundDown(1.101, 2)).toEqual("1.1")
  })

  test("rounds down simple case", () => {
    expect(roundDown(1.001, 2)).toEqual("1")
  })
})
