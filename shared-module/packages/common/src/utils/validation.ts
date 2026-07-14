const validURL = (text: string | null): boolean => {
  if (text === null) {
    return false
  }
  try {
    // oxlint-disable-next-line no-new -- validates input; URL() throws on invalid input
    new URL(text)
    return true
  } catch (_e) {
    return false
  }
}

const validNumber = (text: string | number): boolean => {
  if (typeof text === "number") {
    return true
  }
  try {
    // oxlint-disable-next-line unicorn/prefer-number-coercion -- parseInt intended; Number() differs
    parseInt(text, 10)
    return true
  } catch (_e) {
    return false
  }
}

export { validURL, validNumber }
