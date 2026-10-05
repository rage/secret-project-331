import { studentNumberProblem } from "../studentNumber"

describe("studentNumberProblem", () => {
  it("accepts numbers whose check digit matches, in both current ranges", () => {
    expect(studentNumberProblem("012749139")).toBeNull()
    expect(studentNumberProblem("023255188")).toBeNull()
    expect(studentNumberProblem(" 0232 55188 ")).toBeNull()
  })

  it("rejects a number that lost its leading zero or has the wrong length", () => {
    expect(studentNumberProblem("23255188")).toBe("format")
    expect(studentNumberProblem("0232551880")).toBe("format")
    expect(studentNumberProblem("a23255188")).toBe("format")
    expect(studentNumberProblem("")).toBe("format")
  })

  it("rejects a single mistyped or swapped digit", () => {
    expect(studentNumberProblem("023255189")).toBe("check-digit")
    expect(studentNumberProblem("023255818")).toBe("check-digit")
  })
})
