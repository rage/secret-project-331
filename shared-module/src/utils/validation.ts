const validURL = (text: string): boolean => {
  try {
    new URL(text)
    return true
  } catch (e) {
    return false
  }
}

const validNumber = (text: string): boolean => {
  try {
    parseInt(text)
    return true
  } catch (e) {
    return false
  }
}

export { validURL, validNumber }
