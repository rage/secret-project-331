export function isReactOnSubmitEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: React.BaseSyntheticEvent<object, any, any>,
): value is React.SubmitEvent<HTMLFormElement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valueAsAny = value as any
  if (valueAsAny.submitter !== undefined && valueAsAny.type === "submit") {
    return true
  }
  return false
}
