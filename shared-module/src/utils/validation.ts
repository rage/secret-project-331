const validURL = (text: string | null): boolean => {
  if (text === null) {
    return false
  }
  try {
    new URL(text)
    return true
  } catch (e) {
    return false
  }
}

const validNumber = (text: string | number): boolean => {
  if (typeof text === "number") {
    return true
  }
  try {
    parseInt(text)
    return true
  } catch (e) {
    return false
  }
}

export { validURL, validNumber }
