export const normalizePath = (title: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  const regex = RegExp("([^A-Za-z1-9-])", "g")
  return title.split(" ").join("-").toLocaleLowerCase().replaceAll(regex, "")
}
