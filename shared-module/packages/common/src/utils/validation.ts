const validURL = (text: string | null): boolean => {
  if (text === null) {
    return false
  }
  try {
    new URL(text)
    return true
  } catch {
    return false
  }
}

const validNumber = (text: string | number): boolean => {
  if (typeof text === "number") {
    return true
  }
  try {
    parseInt(text, 10)
    return true
  } catch {
    return false
  }
}

export { validURL, validNumber }
