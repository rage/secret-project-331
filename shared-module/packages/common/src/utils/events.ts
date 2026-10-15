export function isReactOnSubmitEvent(
  // oxlint-disable-next-line typescript/no-explicit-any
  value: React.BaseSyntheticEvent<object, any, any>,
): value is React.SubmitEvent<HTMLFormElement> {
  // oxlint-disable-next-line typescript/no-explicit-any
  const valueAsAny = value as any
  if (valueAsAny.submitter !== undefined && valueAsAny.type === "submit") {
    return true
  }
  return false
}
