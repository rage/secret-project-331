export function formatLogsForDisplay(logs: Record<string, string>): string {
  return (
    Object.entries(logs)
      /* eslint-disable-next-line i18next/no-literal-string -- log output format */
      .map(([k, v]) => `[${k}]\n${v}`)
      .join("\n\n")
  )
}
