export function updateQueryStringParameter(url: string, key: string, value: string) {
  const parsedUrl = new URL(url)
  if (parsedUrl.searchParams.has(key)) {
    parsedUrl.searchParams.delete(key)
  }
  // Need to encode, because otherwise spaces would be unencoded + signs
  parsedUrl.searchParams.append(key, encodeURIComponent(value))
  return parsedUrl.toString()
}
