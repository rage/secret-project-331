export const saveChatbotAnonymousToken = (anonymousToken: string | null | undefined) => {
  if (anonymousToken && typeof window !== "undefined") {
    localStorage.setItem("anonymousToken", anonymousToken)
  } else {
    console.warn("Failed to set anonymous token in localStorage.")
  }
}

export const getSavedChatbotAnonymousToken = () => {
  return typeof window !== "undefined" ? localStorage.getItem("anonymousToken") : null
}

export const removeSavedChatbotAnonymousToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("anonymousToken")
  } else {
    console.warn("Failed to remove anonymous token from localStorage.")
  }
}
