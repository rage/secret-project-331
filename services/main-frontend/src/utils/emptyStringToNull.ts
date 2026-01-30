export const emptyStringToNull = (s: string | null) => {
  return (s?.length ?? 0) > 0 ? s : null
}
