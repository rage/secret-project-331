import { resolveFieldState } from "../src/lib/utils/field"

describe("resolveFieldState", () => {
  test("prefers isDisabled over disabled", () => {
    expect(resolveFieldState({ disabled: true, isDisabled: false }).isDisabled).toBe(false)
  })

  test("prefers isReadOnly over readOnly", () => {
    expect(resolveFieldState({ readOnly: true, isReadOnly: false }).isReadOnly).toBe(false)
  })

  test("prefers isRequired over required", () => {
    expect(resolveFieldState({ required: true, isRequired: false }).isRequired).toBe(false)
  })

  test("treats aria-invalid grammar as invalid", () => {
    expect(resolveFieldState({ ariaInvalid: "grammar" }).isInvalid).toBe(true)
  })

  test("treats aria-invalid false as valid even with error message", () => {
    expect(resolveFieldState({ ariaInvalid: "false", errorMessage: "bad" }).isInvalid).toBe(false)
  })

  test("prefers explicit isInvalid false over error message fallback", () => {
    expect(resolveFieldState({ isInvalid: false, errorMessage: "bad" }).isInvalid).toBe(false)
  })

  test("prefers explicit isInvalid false over aria-invalid true and error message", () => {
    expect(
      resolveFieldState({
        isInvalid: false,
        ariaInvalid: "true",
        errorMessage: "bad",
      }).isInvalid,
    ).toBe(false)
  })

  test("falls back to false when all invalid inputs are absent", () => {
    expect(resolveFieldState({}).isInvalid).toBe(false)
  })

  test("falls back to error message when invalid props are absent", () => {
    expect(resolveFieldState({ errorMessage: "bad" }).isInvalid).toBe(true)
  })
})
