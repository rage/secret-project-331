export const normalizePath = (title: string): string => {
  return title.replaceAll("?", "").split(" ").join("-").toLocaleLowerCase()
}
