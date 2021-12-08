export const convertToSlug = (name: string) => {
  return name.toLowerCase().trim().replaceAll(" ", "-")
}
