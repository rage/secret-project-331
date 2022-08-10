import { useEffect, useState } from "react"

export default function useMessageChannel(): MessageChannel | null {
  const [channel, setChannel] = useState<MessageChannel | null>(null)
  useEffect(() => {
    setChannel(new MessageChannel())
  }, [])
  return channel
}
