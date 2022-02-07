import { css } from "@emotion/css"
import TextField from "@material-ui/core/TextField"
import React, { ChangeEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
import ErrorBanner from "../shared-module/components/ErrorBanner"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"
import Spinner from "../shared-module/components/Spinner"
import useToastMutation from "../shared-module/hooks/useToastMutation"
import { monospaceFont } from "../shared-module/styles"
import { narrowContainerWidthPx } from "../shared-module/styles/constants"

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"

const Home: React.FC = () => {
  const { t } = useTranslation()
  const [exampleUrl, setExampleUrl] = useState<string>("")
  const [exampleWidth, setExampleWidth] = useState<number>(narrowContainerWidthPx)
  const [exampleData, setExampleData] = useState<string>("")
  const [exampleName, setExampleName] = useState<string>("")
  const [combinedUrl, setCombinedUrl] = useState<string>("")
  const [invalidUrl, setInvalidUrl] = useState<boolean>(false)
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null)
  const getPlaygroundExamples = useQuery("playground-examples", () => fetchPlaygroundExamples())
  const saveMutation = useToastMutation(
    savePlaygroundExample,
    {
      notify: true,
      method: "POST",
      successMessage: t("message-saved-succesfully"),
      errorMessage: t("message-saving-failed"),
    },
    {
      onSuccess: () => {
        getPlaygroundExamples.refetch()
        setTimeout(() => saveMutation.reset(), 5000)
      },
      onError: () => {
        setTimeout(() => saveMutation.reset(), 5000)
      },
    },
  )
  const updateMutation = useToastMutation(
    updatePlaygroundExample,
    {
      notify: true,
      method: "PUT",
      successMessage: t("message-update-succesful"),
      errorMessage: t("message-update-failed"),
    },
    {
      onSuccess: () => {
        getPlaygroundExamples.refetch()
        setTimeout(() => updateMutation.reset(), 5000)
      },
      onError: () => {
        setTimeout(() => updateMutation.reset(), 5000)
      },
    },
  )
  const deleteMutation = useToastMutation(
    deletePlaygroundExample,
    {
      notify: true,
      method: "DELETE",
      successMessage: t("message-deleting-succesful"),
      errorMessage: t("message-deleting-failed"),
    },
    {
      onSuccess: () => {
        getPlaygroundExamples.refetch()
        setSelectedExample(null)
        setTimeout(() => deleteMutation.reset(), 5000)
      },
      onError: () => {
        setTimeout(() => deleteMutation.reset(), 5000)
      },
    },
  )

  const onMessage = (message: unknown, responsePort: MessagePort) => {
    console.log(responsePort)
    // eslint-disable-next-line i18next/no-literal-string
    console.log("received message from iframe", message)
  }

  useEffect(() => {
    setCombinedUrl("")
    if (!exampleUrl || !exampleWidth) {
      return
    }
    try {
      // eslint-disable-next-line i18next/no-literal-string
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

  return (
    <Layout>
      <div>
        <h2>{t("title-playground-exercise-iframe")}</h2>
        {getPlaygroundExamples.isError && (
          <ErrorBanner variant={"readOnly"} error={getPlaygroundExamples.error} />
        )}
        {(getPlaygroundExamples.isLoading || getPlaygroundExamples.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getPlaygroundExamples.isSuccess && getPlaygroundExamples.data.length > 0 && (
          <div>
            <h3>{t("title-list-of-examples")}</h3>
            <div
              className={css`
                margin-bottom: 1rem;
                margin-top: 0.5rem;
              `}
            >
              {/* eslint-disable-next-line jsx-a11y/no-onchange */}
              <select
                onChange={handleExampleChange}
                name="playground-examples"
                aria-label={t("playground-examples")}
              >
                <option selected disabled label={t("label-examples")} />
                {getPlaygroundExamples.data.map((example) => (
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
          placeholder={invalidUrl ? t("invalid-url") : t("label-url")}
          label={t("label-url")}
          onChange={handleUrlChange}
          error={invalidUrl}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleWidth || ""}
          placeholder={t("label-width")}
          label={t("label-width")}
          fullWidth
          onChange={handleWidthChange}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleName}
          placeholder={t("label-example-name")}
          label={t("label-example-name")}
          fullWidth
          onChange={handleNameChange}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <br />
        <label id="data-preview-label">{t("data-to-post-to-iframe")}</label>
        <textarea
          rows={20}
          spellCheck={false}
          value={exampleData}
          onChange={(e) => handleDataChange(e.target.value)}
          aria-labelledby="data-preview-label"
          className={css`
            border: 1px solid black;
            margin-bottom: 1rem;
            width: 100%;
            font-family: ${monospaceFont} !important;
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
            {t("button-text-save")}
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
              {t("button-text-update")}
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
              {t("button-text-delete")}
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
            postThisStateToIFrame={{
              // eslint-disable-next-line i18next/no-literal-string
              view_type: "exercise",
              exercise_task_id: EXAMPLE_UUID,
              data: {
                public_spec: JSON.parse(exampleData),
                previous_submission: null,
              },
            }}
            onMessageFromIframe={onMessage}
          />
        </div>
      )}
    </Layout>
  )
}

export default Home
