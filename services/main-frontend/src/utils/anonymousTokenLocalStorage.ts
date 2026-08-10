export const saveChatbotAnonymousToken = (anonymousToken: string | null | undefined) => {
  if (anonymousToken && typeof window !== "undefined") {
    localStorage.setItem("anonymousToken", anonymousToken)
  }
}

export const getSavedChatbotAnonymousToken = () => {
  return typeof window !== "undefined" ? localStorage.getItem("anonymousToken") : null
}

export const removeSavedChatbotAnonymousToken = () => {
  localStorage.removeItem("anonymousToken")
}
