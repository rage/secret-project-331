export function getChatbotEmbedServerUri(port: number | null): string {
  if (port === null) {
    throw new Error("Chatbot embed server not set up.")
  }

  return `http://127.0.0.1:${port}`
}
