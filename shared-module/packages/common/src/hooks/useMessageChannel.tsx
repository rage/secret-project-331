"use client"
import { useEffect, useState } from "react"

export default function useMessageChannel(): [MessageChannel | null, () => void] {
  const [channel, setChannel] = useState<MessageChannel | null>(() => {
    if (typeof MessageChannel !== "undefined") {
      return new MessageChannel()
    }
    return null
  })

  const recreateChannel = () => {
    if (typeof MessageChannel !== "undefined") {
      setChannel(new MessageChannel())
    }
  }

  return [channel, recreateChannel]
}
