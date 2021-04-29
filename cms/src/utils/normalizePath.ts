export const normalizePath = (title: string): string => {
  return "/" + title.split(" ").join("-").toLocaleLowerCase()
}
