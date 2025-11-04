import { useState } from "react"

export default function useMessageChannel(): MessageChannel | null {
  const [channel] = useState<MessageChannel | null>(() => {
    if (typeof MessageChannel !== "undefined") {
      return new MessageChannel()
    }
    return null
  })
  return channel
}
