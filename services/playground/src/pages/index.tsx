import { useState } from "react"

import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

const Home: React.FC = () => {
  const [url] = useState<string | null>(null)
  const [data] = useState<string | null>(null)

  const onChannelEstablished = (port: MessagePort) => {
    console.log("channel established", port)
    console.log("Posting data to iframe")
    if (data) {
      port.postMessage({ msg: "set-state", data: JSON.parse(data) })
    }
  }

  const onMessage = (message: unknown, responsePort: MessagePort) => {
    console.log(responsePort)
    console.log("received message from iframe", message)
  }

  if (!url || !data) {
    return <p>No url or data</p>
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={onChannelEstablished}
      onMessageFromIframe={onMessage}
    />
  )
}

export default Home
