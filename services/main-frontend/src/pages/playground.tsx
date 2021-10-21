import { css } from "@emotion/css"
import {
  Alert,
  FormControl,
  Grow,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from "@material-ui/core"
import TextField from "@material-ui/core/TextField"
import dynamic from "next/dynamic"
import React, { ChangeEvent, useEffect, useState } from "react"
import { useMutation, useQuery } from "react-query"

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
import { defaultContainerWidth } from "../shared-module/styles/constants"

const MonacoLoading = <div>Loading editor...</div>
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => MonacoLoading,
})

const Home: React.FC = () => {
  const [exampleUrl, setExampleUrl] = useState<string>("")
  const [exampleWidth, setExampleWidth] = useState<number>(defaultContainerWidth)
  const [exampleData, setExampleData] = useState<string>("")
  const [exampleName, setExampleName] = useState<string>("")
  const [combinedUrl, setCombinedUrl] = useState<string>("")
  const [invalidUrl, setInvalidUrl] = useState<boolean>(false)
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null)
  const [msg, setMsg] = useState<string>("")
  const { isLoading, error, data, refetch } = useQuery("playground-examples", () =>
    fetchPlaygroundExamples(),
  )
  const saveMutation = useMutation(savePlaygroundExample, {
    onSuccess: () => {
      setMsg("Example saved succesfully")
      refetch()
      setTimeout(() => saveMutation.reset(), 5000)
    },
    onError: () => {
      setMsg("Something went wrong, couldn't save example")
      setTimeout(() => saveMutation.reset(), 5000)
    },
  })
  const updateMutation = useMutation(updatePlaygroundExample, {
    onSuccess: () => {
      setMsg("Example updated succesfully")
      refetch()
      setTimeout(() => updateMutation.reset(), 5000)
    },
    onError: () => {
      setMsg("Something went wrong, couldn't update example")
      setTimeout(() => updateMutation.reset(), 5000)
    },
  })
  const deleteMutation = useMutation(deletePlaygroundExample, {
    onSuccess: () => {
      setMsg("Example deleted succesfully")
      refetch()
      setSelectedExample(null)
      setTimeout(() => deleteMutation.reset(), 5000)
    },
    onError: () => {
      setMsg("Something went wrong, couldn't delete example")
      setTimeout(() => deleteMutation.reset(), 5000)
    },
  })

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
    if (!exampleUrl || !exampleWidth) {
      return
    }
    try {
      const newUrl = new URL(exampleUrl + `?width=${exampleWidth}`)
      setCombinedUrl(newUrl.toString())
      setInvalidUrl(false)
    } catch (error) {
      console.log(error)
      setInvalidUrl(true)
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
    if (e) {
      setExampleData(e)
    }
  }

  const handleExampleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const example: PlaygroundExample = JSON.parse(event.target.value) as PlaygroundExample
    setExampleUrl(example.url)
    setExampleWidth(example.width)
    setExampleData(JSON.stringify(example.data as unknown, undefined, 2))
    setExampleName(example.name)
    setSelectedExample(example)
  }

  const handleExampleSave = async () => {
    saveMutation.mutate({
      name: exampleName,
      url: exampleUrl,
      width: exampleWidth,
      data: JSON.parse(exampleData),
    })
  }

  const handleExampleUpdate = async () => {
    if (!selectedExample) {
      return
    }
    updateMutation.mutate({
      ...selectedExample,
      name: exampleName,
      url: exampleUrl,
      width: exampleWidth,
      data: JSON.parse(exampleData),
    })
  }

  const handleExampleDeletion = async () => {
    if (!selectedExample) {
      return
    }
    deleteMutation.mutate(selectedExample.id)
  }

  if (isLoading || !data) {
    return <p>loading</p>
  }

  if (error) {
    return <pre>{JSON.stringify(error)}</pre>
  }

  return (
    <Layout>
      <div className={normalWidthCenteredComponentStyles}>
        <Grow
          in={
            saveMutation.isError ||
            saveMutation.isSuccess ||
            updateMutation.isError ||
            updateMutation.isSuccess ||
            deleteMutation.isError ||
            deleteMutation.isSuccess
          }
        >
          <Alert
            severity={
              saveMutation.isSuccess || updateMutation.isSuccess || deleteMutation.isSuccess
                ? "success"
                : "error"
            }
          >
            <div
              className={css`
                font-size: 150%;
              `}
            >
              {msg}
            </div>
          </Alert>
        </Grow>
        <h2>Playground for exercise IFrames</h2>
        {data.length > 0 && (
          <div>
            <h4>List of examples</h4>
            <div
              className={css`
                margin-bottom: 1rem;
                margin-top: 0.5rem;
              `}
            >
              {/* eslint-disable-next-line jsx-a11y/no-onchange */}
              <select onChange={handleExampleChange} name="playground-examples">
                <option selected disabled label="Examples" />
                {data.map((example) => (
                  <option
                    key={JSON.stringify(example)}
                    value={JSON.stringify(example)}
                    label={example.name}
                  />
                ))}
              </select>
            </div>
          </div>
        )}
        <TextField
          value={exampleUrl || ""}
          fullWidth
          placeholder={invalidUrl ? "Invalid URL" : "URL"}
          label="URL"
          onChange={handleUrlChange}
          error={invalidUrl}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleWidth || ""}
          placeholder="Width"
          label="Width"
          fullWidth
          onChange={handleWidthChange}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleName}
          placeholder="Example name"
          label="Example name"
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
          onChange={(value) => value && handleDataChange(value)}
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
            disabled={saveMutation.isLoading}
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
              disabled={updateMutation.isLoading}
            >
              Update example
            </Button>
            <Button
              onClick={handleExampleDeletion}
              variant="primary"
              size="medium"
              disabled={deleteMutation.isLoading}
              className={css`
                margin-left: 1rem;
              `}
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
