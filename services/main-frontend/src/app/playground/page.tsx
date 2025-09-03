import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { ChangeEvent, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  deletePlaygroundExample,
  fetchPlaygroundExamples,
  savePlaygroundExample,
  updatePlaygroundExample,
} from "../services/backend/playground-examples"

import { PlaygroundExample } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import MessageChannelIFrame from "@/shared-module/common/components/MessageChannelIFrame"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { monospaceFont } from "@/shared-module/common/styles"
import { narrowContainerWidthPx } from "@/shared-module/common/styles/constants"
import getGuestPseudonymousUserId from "@/shared-module/common/utils/getGuestPseudonymousUserId"

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const Home: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const [exampleUrl, setExampleUrl] = useState<string>("")
  const [exampleWidth, setExampleWidth] = useState<number>(narrowContainerWidthPx)
  const [exampleData, setExampleData] = useState<string>("")
  const [exampleName, setExampleName] = useState<string>("")
  const [combinedUrl, setCombinedUrl] = useState<string>("")
  const [invalidUrl, setInvalidUrl] = useState<boolean>(false)
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null)
  const getPlaygroundExamples = useQuery({
    queryKey: ["playground-examples"],
    queryFn: () => fetchPlaygroundExamples(),
  })
  const saveMutation = useToastMutation(
    savePlaygroundExample,
    {
      notify: true,
      method: "POST",
      successMessage: t("message-saved-successfully"),
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
    console.info(responsePort)

    console.info("received message from iframe", message)
  }

  useEffect(() => {
    setCombinedUrl("")
    if (!exampleUrl || !exampleWidth) {
      return
    }
    try {
      const newUrl = new URL(exampleUrl)
      setCombinedUrl(newUrl.toString())
      setInvalidUrl(false)
    } catch (error) {
      setInvalidUrl(true)
      console.error(error)
    }
  }, [exampleUrl, exampleWidth])

  const handleUrlChange = (value: string) => {
    setExampleUrl(value)
  }

  const handleWidthChange = (value: string) => {
    setExampleWidth(Number(value))
  }

  const handleNameChange = (value: string) => {
    setExampleName(value)
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
    <>
      <div>
        <h2>{t("title-playground-exercise-iframe")}</h2>
        {getPlaygroundExamples.isError && (
          <ErrorBanner variant={"readOnly"} error={getPlaygroundExamples.error} />
        )}
        {getPlaygroundExamples.isPending && <Spinner variant={"medium"} />}
        {getPlaygroundExamples.isSuccess && getPlaygroundExamples.data.length > 0 && (
          <div>
            <h3>{t("title-list-of-examples")}</h3>
            <div
              className={css`
                margin-bottom: 1rem;
                margin-top: 0.5rem;
              `}
            >
              {}
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
          placeholder={invalidUrl ? t("invalid-url") : t("label-url")}
          label={t("label-url")}
          onChangeByValue={(value) => handleUrlChange(value)}
          error={invalidUrl ? t("invalid-url") : undefined}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={String(exampleWidth) || ""}
          placeholder={t("label-width")}
          label={t("label-width")}
          onChangeByValue={(value) => handleWidthChange(value)}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          value={exampleName}
          placeholder={t("label-example-name")}
          label={t("label-example-name")}
          onChangeByValue={(value) => handleNameChange(value)}
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
            disabled={saveMutation.isPending}
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
              disabled={updateMutation.isPending}
            >
              {t("button-text-update")}
            </Button>
            <Button
              onClick={handleExampleDeletion}
              variant="primary"
              size="medium"
              disabled={deleteMutation.isPending}
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
              view_type: "answer-exercise",
              exercise_task_id: EXAMPLE_UUID,
              user_information: {
                pseudonymous_id: getGuestPseudonymousUserId(),
                signed_in: true,
              },
              data: {
                public_spec: JSON.parse(exampleData),
                previous_submission: null,
              },
            }}
            onMessageFromIframe={onMessage}
            title={TITLE}
          />
        </div>
      )}
    </>
  )
}

export default Home
