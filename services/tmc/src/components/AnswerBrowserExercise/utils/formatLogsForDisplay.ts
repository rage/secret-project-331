export function formatLogsForDisplay(logs: Record<string, string>): string {
  return Object.entries(logs)

    .map(([k, v]) => `[${k}]\n${v}`)
    .join("\n\n")
}
