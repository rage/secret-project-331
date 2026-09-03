"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { ChangeEvent } from "react"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  deletePlaygroundExampleMutation as deletePlaygroundExampleMutationOptions,
  getPlaygroundExamplesOptions,
  createPlaygroundExampleMutation as savePlaygroundExampleMutationOptions,
  updatePlaygroundExampleMutation as updatePlaygroundExampleMutationOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import type { PlaygroundExample } from "@/generated/api/types.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { monospaceFont } from "@/shared-module/common/styles"
import { narrowContainerWidthPx } from "@/shared-module/common/styles/constants"
import getGuestPseudonymousUserId from "@/shared-module/common/utils/getGuestPseudonymousUserId"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { Button, QueryResult, TextField, useDialog } from "@/shared-module/components"
import MessageChannelIFrame from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

const onMessage = (message: unknown, responsePort: MessagePort) => {
  console.info(responsePort)

  console.info("received message from iframe", message)
}

const Home: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("title-playground-exercise-iframe"))
  const dialog = useDialog()
  const { control, setValue, watch } = useForm<{ url: string; width: string; name: string }>({
    defaultValues: { url: "", width: String(narrowContainerWidthPx), name: "" },
  })
  const exampleUrl = watch("url")
  const exampleWidth = Number(watch("width"))
  const exampleName = watch("name")
  const [exampleData, setExampleData] = useState<string>("")
  const [combinedUrl, setCombinedUrl] = useState<string>("")
  const [invalidUrl, setInvalidUrl] = useState<boolean>(false)
  const [selectedExample, setSelectedExample] = useState<PlaygroundExample | null>(null)
  const getPlaygroundExamples = useQuery(getPlaygroundExamplesOptions())
  const saveMutation = useToastMutationOptions(
    savePlaygroundExampleMutationOptions(),
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
  const updateMutation = useToastMutationOptions(
    updatePlaygroundExampleMutationOptions(),
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
  const deleteMutation = useToastMutationOptions(
    deletePlaygroundExampleMutationOptions(),
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

  const handleDataChange = (e: string) => {
    if (e) {
      setExampleData(e)
    }
  }

  const handleExampleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const example: PlaygroundExample = JSON.parse(event.target.value) as PlaygroundExample
    setValue("url", example.url)
    setValue("width", String(example.width))
    setExampleData(JSON.stringify(example.data as unknown, undefined, 2))
    setValue("name", example.name)
    setSelectedExample(example)
  }

  const handleExampleSave = () => {
    saveMutation.mutate({
      body: {
        name: exampleName,
        url: exampleUrl,
        width: exampleWidth,
        data: JSON.parse(exampleData),
      },
    })
  }

  const handleExampleUpdate = () => {
    if (!selectedExample) {
      return
    }
    updateMutation.mutate({
      body: {
        ...selectedExample,
        name: exampleName,
        url: exampleUrl,
        width: exampleWidth,
        data: JSON.parse(exampleData),
      },
    })
  }

  const handleExampleDeletion = () => {
    if (!selectedExample) {
      return
    }
    deleteMutation.mutate({
      path: {
        playground_example_id: selectedExample.id,
      },
    })
  }

  return (
    <>
      <div>
        <h2>{t("title-playground-exercise-iframe")}</h2>
        <QueryResult query={getPlaygroundExamples}>
          {(data) => (
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
                  {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label -- label attr is the accessible name */}
                  <option selected disabled label={t("label-examples")} />
                  {data.map((example) => (
                    // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- label attr is the accessible name
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
        </QueryResult>
        <TextField
          name="url"
          control={control}
          label={t("label-url")}
          {...includeIf(invalidUrl, { errorMessage: t("invalid-url") })}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          name="width"
          control={control}
          label={t("label-width")}
          className={css`
            margin-bottom: 1rem !important;
          `}
        />
        <TextField
          name="name"
          control={control}
          label={t("label-example-name")}
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
            dialog={dialog}
            key={combinedUrl + exampleData}
            url={combinedUrl}
            postThisStateToIFrame={{
              // oxlint-disable-next-line i18next/no-literal-string
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
