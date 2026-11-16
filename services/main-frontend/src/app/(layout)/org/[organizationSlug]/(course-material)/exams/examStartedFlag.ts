let examJustStarted = false

/** Set when the student confirms starting; the running view consumes it on mount. */
export const setExamJustStarted = (value: boolean) => {
  examJustStarted = value
}

export const consumeExamJustStarted = (): boolean => {
  const value = examJustStarted
  examJustStarted = false
  return value
}
