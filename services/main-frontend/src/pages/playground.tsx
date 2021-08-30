import { css } from "@emotion/css"
import { Alert, Grow, MenuItem, Select, SelectChangeEvent } from "@material-ui/core"
import TextField from "@material-ui/core/TextField"
import dynamic from "next/dynamic"
import React, { useEffect, useState } from "react"
import { useQuery } from "react-query"

import Layout from "../components/Layout"
import {
  deletePlaygroundExample,
  fetchPlaygroundExamples,
  savePlaygroundExample,
  updatePlaygroundExample,
} from "../services/backend/playground-examples"
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
  const [exampleUrl, setExampleUrl] = useState<string | null>(null)
  const [exampleWidth, setExampleWidth] = useState<number | null>(null)
  const [exampleData, setExampleData] = useState<string | null>(null)
  const [exampleName, setExampleName] = useState<string | null>(null)
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null)
  const [err, setErr] = useState<boolean>(false)
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null)
  const [processing, setProcessing] = useState<boolean>(false)
  const [showAlert, setShowAlert] = useState<boolean>(false)
  const [success, setSuccess] = useState<boolean>(true)
  const [message, setMessage] = useState<string | null>(null)
  const { isLoading, error, data, refetch } = useQuery("playground-examples", () =>
    fetchPlaygroundExamples(),
  )

  const onChannelEstablished = (port: MessagePort) => {
    console.log("channel established", port)
    console.log("Posting data to iframe")
    if (exampleData) {
      port.postMessage({ message: "set-state", data: JSON.parse(exampleData) })
    }
  }

  const onMessage = (message: unknown, responsePort: MessagePort) => {
    console.log(responsePort)
    console.log("received message from iframe", message)
  }

  useEffect(() => {
    setCombinedUrl("")
    if (!exampleUrl || !exampleWidth) return
    try {
      const newUrl = new URL(exampleUrl + `?width=${exampleWidth}`)
      setCombinedUrl(newUrl.toString())
      setErr(false)
    } catch (error) {
      console.log(error)
      setErr(true)
    }
  }, [exampleUrl, exampleWidth])

  const handleUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setExampleUrl(e.target.value)
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setExampleWidth(Number(e.target.value))
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    setExampleName(e.target.value)
  }

  const handleDataChange = (e: string) => {
    if (e) setExampleData(e)
  }

  const handleExampleChange = (event: SelectChangeEvent) => {
    const example: PlaygroundExample = JSON.parse(event.target.value) as PlaygroundExample
    setExampleUrl(example.url)
    setExampleWidth(example.width)
    setExampleData(example.data as any)
    setExampleName(example.name)
    setSelectedExample(example)
  }

  const handleExampleSave = async () => {
    try {
      setProcessing(true)
      await savePlaygroundExample({
        name: exampleName,
        url: exampleUrl,
        width: exampleWidth,
        data: exampleData,
      })
      refetch()
      setProcessing(false)
      setShowAlert(true)
      setSuccess(true)
      setMessage("Example saved succesfully")
      setTimeout(() => setShowAlert(false), 5000)
    } catch (error) {
      console.error(error)
      setShowAlert(true)
      setSuccess(false)
      setMessage("Something went wrong, couldn't save example")
      setTimeout(() => setShowAlert(false), 5000)
    }
  }

  const handleExampleUpdate = async () => {
    try {
      setProcessing(true)
      const res = await updatePlaygroundExample({
        ...selectedExample,
        name: exampleName,
        url: exampleUrl,
        width: exampleWidth,
        data: exampleData,
      })
      setSelectedExample(res)
      refetch()
      setProcessing(false)
      setShowAlert(true)
      setSuccess(true)
      setMessage("Example updated succesfully")
      setTimeout(() => setShowAlert(false), 5000)
    } catch (error) {
      console.error(error)
      setShowAlert(true)
      setSuccess(false)
      setMessage("Something went wrong, couldn't update example")
      setTimeout(() => setShowAlert(false), 5000)
    }
  }

  const handleExampleDeletion = async () => {
    try {
      setProcessing(true)
      await deletePlaygroundExample(selectedExample.id)
      refetch()
      setSelectedExample(null)
      setExampleUrl(null)
      setExampleWidth(null)
      setExampleData(null)
      setExampleName(null)
      setProcessing(false)
      setShowAlert(true)
      setSuccess(true)
      setMessage("Example deleted succesfully")
      setTimeout(() => setShowAlert(false), 5000)
    } catch (error) {
      console.error(error)
      setShowAlert(true)
      setSuccess(false)
      setMessage("Something went wrong, couldn't delete example")
      setTimeout(() => setShowAlert(false), 5000)
    }
  }

  if (isLoading || !data) {
    return <p>loading</p>
  }

  if (error) {
    return <pre>{error}</pre>
  }

  return (
    <Layout frontPageUrl="/" navVariant="simple">
      <div className={normalWidthCenteredComponentStyles}>
        <Grow in={showAlert} timeout={2}>
          <Alert severity={success ? "success" : "error"}>
            <div
              className={css`
                font-size: 150%;
              `}
            >
              {message}
            </div>
          </Alert>
        </Grow>
        <h2>Insert URL, width and data</h2>
        {data.length > 0 && (
          <div>
            <h4>List of examples</h4>
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
          </div>
        )}
        <TextField
          value={exampleUrl}
          fullWidth
          placeholder={err ? "Invalid URL" : "URL"}
          onChange={handleUrlChange}
          error={err}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleWidth}
          placeholder="width"
          fullWidth
          onChange={handleWidthChange}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleName}
          placeholder="example name"
          fullWidth
          onChange={handleNameChange}
          className={css`
            margin-bottom: 1rem !important;
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
            tabSize: 2,
          }}
          value={exampleData}
          onChange={(value) => handleDataChange(value)}
          width="30vw"
          height="50vh"
          className={css`
            border: 1px solid black;
            margin-bottom: 1rem;
            width: 100%;
          `}
        />
        {exampleUrl && exampleWidth && exampleData && exampleName && (
          <Button
            variant="primary"
            size="medium"
            onClick={handleExampleSave}
            className={css`
              margin-right: 1rem;
            `}
            disabled={processing}
          >
            Save example
          </Button>
        )}
        {selectedExample && (
          <>
            <Button
              onClick={handleExampleUpdate}
              variant="primary"
              size="medium"
              disabled={processing}
            >
              Update example
            </Button>
            <Button
              onClick={handleExampleDeletion}
              variant="primary"
              size="medium"
              className={css`
                margin-left: 1rem;
              `}
              disabled={processing}
            >
              Delete example
            </Button>
          </>
        )}
      </div>
      {combinedUrl && exampleData && (
        <div
          className={css`
            margin-top: 1rem;
          `}
        >
          <MessageChannelIFrame
            key={combinedUrl + exampleData}
            url={combinedUrl}
            onCommunicationChannelEstabilished={onChannelEstablished}
            onMessageFromIframe={onMessage}
          />
        </div>
      )}
    </Layout>
  )
}

export default Home
