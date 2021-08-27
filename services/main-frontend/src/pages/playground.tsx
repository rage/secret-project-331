import { css } from "@emotion/css"
import { MenuItem, Select, SelectChangeEvent } from "@material-ui/core"
import TextField from "@material-ui/core/TextField"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"
import { useQuery } from "react-query"

import {
  deletePlaygroundExample,
  fetchPlaygroundExamples,
  savePlaygroundExample,
} from "../services/backend/exercises"
import { PlaygroundExample } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"
import { normalWidthCenteredComponentStyles } from "../shared-module/styles/componentStyles"

const MonacoLoading = <div>Loading editor...</div>
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const Home: React.FC = () => {
  const [url, setUrl] = useState<string | null>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null)
  const [playgroundData, setPlaygroundData] = useState<string | null>(null)
  const [exampleName, setExampleName] = useState<string | null>(null)
  const [err, setErr] = useState<boolean>(false)
  const [exampleId, setExampleId] = useState<string | null>(null)
  const { isLoading, error, data, refetch } = useQuery("playground-examples", () =>
    fetchPlaygroundExamples(),
  )

  const onChannelEstablished = (port: MessagePort) => {
    console.log("channel established", port)
    console.log("Posting data to iframe")
    if (playgroundData) {
      port.postMessage({ message: "set-state", data: JSON.parse(playgroundData) })
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
    setWidth(Number(e.target.value))
  }

  const handleDataChange = (e: string) => {
    if (e) setPlaygroundData(e)
  }

  const handleExampleChange = (event: SelectChangeEvent) => {
    const { id, name, url, width, data }: PlaygroundExample = JSON.parse(
      event.target.value,
    ) as PlaygroundExample
    setUrl(url)
    setWidth(width)
    setPlaygroundData(data as any)
    setExampleId(id)
    setExampleName(name)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setExampleName(e.target.value)
  }

  const handleExampleSave = async () => {
    try {
      await savePlaygroundExample({
        name: exampleName,
        url: url,
        width: width,
        data: playgroundData,
      })
      refetch()
    } catch (error) {
      console.error(error)
    }
  }

  const handleExampleDeletion = async () => {
    try {
      await deletePlaygroundExample(exampleId)
      refetch()
      setExampleId(null)
      setUrl(null)
      setWidth(null)
      setPlaygroundData(null)
      setExampleName(null)
    } catch (error) {
      console.error(error)
    }
  }

  if (isLoading || !data) {
    return <p>loading</p>
  }

  if (error) {
    return <pre>{error}</pre>
  }

  return (
    <div>
      <div className={normalWidthCenteredComponentStyles}>
        <h1>Insert URL, width and data</h1>
        <h2>List of examples</h2>
        {data.length > 0 && (
          <Select
            onChange={handleExampleChange}
            defaultValue={data[0].name}
            fullWidth
            className={css`
              margin-bottom: 1rem;
            `}
          >
            {data.map((example) => (
              <MenuItem key={JSON.stringify(example)} value={JSON.stringify(example)}>
                {example.name}
              </MenuItem>
            ))}
          </Select>
        )}
        <TextField
          defaultValue={url}
          value={url}
          fullWidth
          placeholder={err ? "Invalid URL" : "URL"}
          onChange={handleUrlChange}
          error={err}
          className={css`
            margin-bottom: 1rem;
          `}
        />
        <TextField
          defaultValue={width}
          value={width}
          placeholder="width"
          fullWidth
          onChange={handleWidthChange}
          className={css`
            margin-bottom: 1rem;
          `}
        />
        <TextField
          defaultValue={exampleName}
          value={exampleName}
          placeholder="example name"
          fullWidth
          onChange={handleNameChange}
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
            formatOnType: true,
            formatOnPaste: true,
          }}
          value={playgroundData}
          defaultValue={playgroundData || undefined}
          onChange={(value) => handleDataChange(value)}
          width="30vw"
          height="50vh"
          className={css`
            border: 1px solid black;
            margin-bottom: 1rem;
          `}
        />
        {url && width && playgroundData && exampleName && (
          <Button
            variant="primary"
            size="medium"
            onClick={handleExampleSave}
            className={css`
              margin-bottom: 1rem;
            `}
          >
            Save example
          </Button>
        )}
        {exampleId && (
          <Button onClick={handleExampleDeletion} variant="primary" size="medium">
            Delete example
          </Button>
        )}
      </div>
      {combinedUrl && playgroundData && (
        <MessageChannelIFrame
          key={combinedUrl + playgroundData}
          url={combinedUrl}
          onCommunicationChannelEstabilished={onChannelEstablished}
          onMessageFromIframe={onMessage}
        />
      )}
    </div>
  )
}

export default Home
