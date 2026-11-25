/** `items` joined into one phrase the way `language` lists things, e.g. "A, B and C". */
export const formatConjunctionList = (language: string, items: readonly string[]): string =>
  new Intl.ListFormat(language, { type: "conjunction" }).format(items)
