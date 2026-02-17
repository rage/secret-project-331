export function extensionToLanguage(path: string): string | undefined {
  /* eslint-disable i18next/no-literal-string */
  const separator = path.lastIndexOf(".")
  if (separator == -1) {
    return undefined
  }
  const extension = path.substring(separator + 1)
  switch (extension) {
    case "js":
      return "javascript"
    case "ts":
      return "typescript"
    case "py":
    case "ipynb":
      return "python"
    case "cs":
      return "csharp"
    default:
      return extension
  }
  /* eslint-enable i18next/no-literal-string */
}
