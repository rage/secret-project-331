export const sanitizeChatbotName = (value: string): string =>
  value.replaceAll(/[^\p{L}\p{N} ]/gu, "")
