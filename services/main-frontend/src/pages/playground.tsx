import TextField from "@material-ui/core/TextField"
import React, { useState } from "react"

import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"

const Home: React.FC = () => {
  const [url, setUrl] = useState<string | null>(null)
  const [data, setData] = useState<string | null>(null)
  const [err, setErr] = useState<boolean>(false)

  const onChannelEstablished = (port: MessagePort) => {
    console.log("channel established", port)
    console.log("Posting data to iframe")
    if (data) {
      port.postMessage({ message: "set-state", data: JSON.parse(data) })
    }
  }

  const onMessage = (message: unknown, responsePort: MessagePort) => {
    console.log(responsePort)
    console.log("received message from iframe", message)
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    try {
      const newUrl = new URL(e.target.value)
      setUrl(newUrl.toString())
      setErr(false)
    } catch (error) {
      console.log(error)
      setErr(true)
    }
  }

  const handleDataChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setData(e.target.value)
  }

  return (
    <div>
      <p>insert URL and data</p>
      <TextField placeholder={err ? "Invalid URL" : "URL"} onChange={handleUrlChange} error={err} />
      <br />
      <TextField placeholder="Public spec data" onChange={handleDataChange} multiline />
      {url && data && (
        <MessageChannelIFrame
          url={url}
          onCommunicationChannelEstabilished={onChannelEstablished}
          onMessageFromIframe={onMessage}
        />
      )}
    </div>
  )
}

export default Home
