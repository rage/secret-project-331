export const normalizePath = (title: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  const regex = RegExp("([^A-Za-z0-9-])", "g")
  return title
    .split(" ")
    .join("-")
    .toLocaleLowerCase()
    .replaceAll("ä", "a")
    .replaceAll("ö", "o")
    .replaceAll("å", "a")
    .replaceAll("ü", "u")
    .replaceAll(regex, "")
}
