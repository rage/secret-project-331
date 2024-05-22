export function runCallbackIfEnterPressed(event: React.KeyboardEvent, callback: () => void): void {
  if (event.key !== "Enter") {
    return
  }
  callback()
}
