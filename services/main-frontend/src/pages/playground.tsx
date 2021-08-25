import { css } from "@emotion/css"
import TextField from "@material-ui/core/TextField"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"

import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"
import { normalWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"

const MonacoLoading = <div>Loading editor...</div>
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const Home: React.FC = () => {
  const [url, setUrl] = useState<string | null>(null)
  const [width, setWidth] = useState<string | null>(null)
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null)
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

  useEffect(() => {
    setCombinedUrl("")
    if (!url || !width) return
    try {
      const newUrl = new URL(url + `?width=${width}`)
      setCombinedUrl(newUrl.toString())
      setErr(false)
    } catch (error) {
      console.log(error)
      setErr(true)
    }
  }, [url, width])

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setUrl(e.target.value)
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setWidth(e.target.value)
  }

  const handleDataChange = (e: string) => {
    if (e) setData(e)
  }

  return (
    <div>
      <div className={normalWidthCenteredComponentStyles}>
        <h1>Insert URL, width and data</h1>
        <TextField
          fullWidth
          placeholder={err ? "Invalid URL" : "URL"}
          onChange={handleUrlChange}
          error={err}
          className={css`
            margin-bottom: 1rem;
          `}
        />
        <TextField
          placeholder="width"
          fullWidth
          onChange={handleWidthChange}
          className={css`
            margin-bottom: 1rem;
          `}
        />
        <br />
        <Editor
          defaultLanguage="json"
          options={{
            wordWrap: "on",
            readOnly: false,
            scrollBeyondLastLine: false,
            roundedSelection: false,
          }}
          defaultValue={data || undefined}
          onChange={(value) => handleDataChange(value)}
          width="30vw"
          height="50vh"
          className={css`
            border: 1px solid black;
            margin-bottom: 1rem;
          `}
        />
      </div>
      {combinedUrl && data && (
        <MessageChannelIFrame
          key={combinedUrl + data}
          url={combinedUrl}
          onCommunicationChannelEstabilished={onChannelEstablished}
          onMessageFromIframe={onMessage}
        />
      )}
    </div>
  )
}

export default Home
