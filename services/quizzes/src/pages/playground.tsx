import { useState } from "react"

import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

const Playground: React.FC = () => {
  const [url] = useState<string>("")
  const [data] = useState<unknown>({})

  const onChannelEstablished = (port: MessagePort) => {
    console.log("HEP")
    console.log("channel established", port)
    console.log("Posting data to iframe")
    port.postMessage({ msg: "set-state", data: data })
  }

  const onMessage = (message: unknown, responsePort: MessagePort) => {
    console.log("HAP")
    console.log(responsePort)
    console.log("received message from iframe", message)
  }

  return (
    <MessageChannelIFrame
      url={url}
      onCommunicationChannelEstabilished={onChannelEstablished}
      onMessageFromIframe={onMessage}
    />
  )
}

export default Playground
