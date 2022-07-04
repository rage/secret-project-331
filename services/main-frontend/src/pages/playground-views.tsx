import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import axios from "axios"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../components/Layout"
import { ExerciseServiceInfoApi } from "../shared-module/bindings"
import { isExerciseServiceInfoApi } from "../shared-module/bindings.guard"
import Button from "../shared-module/components/Button"
import DebugModal from "../shared-module/components/DebugModal"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import CheckBox from "../shared-module/components/InputFields/CheckBox"
import TextAreaField from "../shared-module/components/InputFields/TextAreaField"
import TextField from "../shared-module/components/InputFields/TextField"
import MessageChannelIFrame from "../shared-module/components/MessageChannelIFrame"
import Spinner from "../shared-module/components/Spinner"
import { CurrentStateMessage, IframeViewType } from "../shared-module/iframe-protocol-types"
import { baseTheme, monospaceFont } from "../shared-module/styles"

const EXAMPLE_UUID = "886d57ba-4c88-4d88-9057-5e88f35ae25f"
const TITLE = "PLAYGROUND"

interface PlaygroundFields {
  url: string
  width: string
  private_spec: string
  showIframeBorders: boolean
}

const Area = styled.div`
  margin-bottom: 1rem;
`

const IframeViewPlayground: React.FC = () => {
  const { t } = useTranslation()

  const [currentStateReceivedFromIframe, setCurrentStateReceivedFromIframe] =
    useState<CurrentStateMessage | null>(null)
  // eslint-disable-next-line i18next/no-literal-string
  const [currentView, _setCurrentView] = useState<IframeViewType>("exercise-editor")

  const { register, setValue, watch } = useForm<PlaygroundFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      // eslint-disable-next-line i18next/no-literal-string
      url: "http://project-331.local/example-exercise/api/service-info",
      width: "700",
      // eslint-disable-next-line i18next/no-literal-string
      private_spec: "null",
      showIframeBorders: false,
    },
  })

  const width = watch("width")
  const url = watch("url")
  const privateSpec = watch("private_spec")
  const showIframeBorders = watch("showIframeBorders")

  let exerciseServiceHost = ""
  try {
    const parsedUrl = new URL(url)
    exerciseServiceHost = `${parsedUrl.protocol}//${parsedUrl.host}`
  } catch {
    // eslint-disable-next-line i18next/no-literal-string
    console.warn("Could not parse URL")
  }

  let privateSpecValidJson = false
  let privateSpecParsed: unknown = null

  try {
    privateSpecParsed = JSON.parse(privateSpec)
    privateSpecValidJson = true
  } catch (e) {
    // eslint-disable-next-line i18next/no-literal-string
    console.warn("Private spec was invalid JSON", e)
  }

  // Makes sure the iframe renders again when the data changes
  const iframeKey = url + width + privateSpec

  const serviceInfoQuery = useQuery(
    `iframe-view-playground-service-info-${url}`,
    async (): Promise<ExerciseServiceInfoApi> => {
      const res = await axios.get(url)
      return res.data
    },
  )

  const isValidServiceInfo = isExerciseServiceInfoApi(serviceInfoQuery.data)

  const publicSpecQuery = useQuery(
    `iframe-view-playground-public-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`,
    async (): Promise<unknown> => {
      if (!serviceInfoQuery.data || !isValidServiceInfo || !privateSpecValidJson) {
        throw new Error("This query should be disabled.")
      }
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.public_spec_endpoint_path}`,
        privateSpecParsed,
      )
      return res.data
    },
    {
      enabled:
        serviceInfoQuery.isSuccess &&
        Boolean(serviceInfoQuery.data) &&
        isValidServiceInfo &&
        privateSpecValidJson,
      retry: false,
    },
  )

  const modelSolutionSpecQuery = useQuery(
    `iframe-view-playground-model-solution-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`,
    async (): Promise<unknown> => {
      if (!serviceInfoQuery.data || !isValidServiceInfo || !privateSpecValidJson) {
        throw new Error("This query should be disabled.")
      }
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.model_solution_spec_endpoint_path}`,
        privateSpecParsed,
      )
      return res.data
    },
    {
      enabled:
        serviceInfoQuery.isSuccess &&
        Boolean(serviceInfoQuery.data) &&
        isValidServiceInfo &&
        privateSpecValidJson,
      retry: false,
    },
  )

  return (
    <Layout>
      <Area>
        <h1>{t("title-playground-exercise-iframe")}</h1>
        <br />

        <TextField label={t("service-info-url")} register={register("url")} />
        {serviceInfoQuery.isError && t("error-fetching-service-info")}
        {!serviceInfoQuery.isLoading && (
          <div
            className={css`
              margin-top: -0.7rem;
              margin-bottom: 0.2rem;
              padding-left: 1rem;
            `}
          >
            <FontAwesomeIcon
              icon={isValidServiceInfo ? faCheck : faXmark}
              className={css`
                color: ${isValidServiceInfo
                  ? baseTheme.colors.green[400]
                  : baseTheme.colors.red[500]};
              `}
            />
            <span
              className={css`
                margin: 0 0.5rem;
              `}
            >
              {isValidServiceInfo ? t("valid-service-info") : t("invalid-service-info")}
            </span>
            <DebugModal data={serviceInfoQuery.data} buttonSize="small" />
          </div>
        )}
        <TextField
          placeholder={t("label-width")}
          label={t("label-width")}
          register={register("width")}
        />
        <TextAreaField
          rows={20}
          spellCheck={false}
          label={t("private-spec")}
          register={register("private_spec", {
            validate: (value) => {
              try {
                JSON.parse(value)
                return true
              } catch (_e) {
                return false
              }
            },
          })}
          className={css`
            margin-bottom: 1rem;
            textarea {
              width: 100%;
              font-family: ${monospaceFont} !important;
              resize: vertical;
            }
          `}
        />
        <CheckBox label={t("show-iframe-borders")} register={register("showIframeBorders")} />
      </Area>

      <Area>
        <h2>{t("title-derived-specs")}</h2>

        <p>{t("derived-specs-explanation")}</p>
      </Area>

      <Area>
        <h3>{t("title-public-spec")}</h3>

        <p>{t("public-spec-explanation")}</p>

        {publicSpecQuery.isError && (
          <ErrorBanner variant={"readOnly"} error={publicSpecQuery.error} />
        )}
        {publicSpecQuery.isLoading && <Spinner variant={"medium"} />}
        {publicSpecQuery.isIdle && <p>{t("error-cannot-load-with-the-given-inputs")}</p>}
        {publicSpecQuery.isSuccess && (
          <pre>{JSON.stringify(publicSpecQuery.data, undefined, 2)}</pre>
        )}
      </Area>

      <Area>
        <h3>{t("title-model-solution-spec")}</h3>

        <p>{t("model-solution-spec-explanation")}</p>

        {modelSolutionSpecQuery.isError && (
          <ErrorBanner variant={"readOnly"} error={modelSolutionSpecQuery.error} />
        )}
        {modelSolutionSpecQuery.isLoading && <Spinner variant={"medium"} />}
        {modelSolutionSpecQuery.isIdle && <p>{t("error-cannot-load-with-the-given-inputs")}</p>}
        {modelSolutionSpecQuery.isSuccess && (
          <pre>{JSON.stringify(modelSolutionSpecQuery.data, undefined, 2)}</pre>
        )}
      </Area>

      <Area>
        <h2>{t("title-iframe")}</h2>
        <Area>
          <div
            className={css`
              background-color: ${baseTheme.colors.clear[200]};
              padding: 0.75rem;

              button {
                background-color: ${baseTheme.colors.clear[200]};
                border-radius: 0.5rem;
                border: none;
                padding: 0.5rem;
                margin: 0 0.5rem;
                cursor: pointer;
                cursor: not-allowed !important;

                &:hover {
                  filter: contrast(1.2) brightness(0.88);
                }

                &[data-active="1"] {
                  background-color: white;

                  &:hover {
                    filter: unset;
                    cursor: unset;
                  }
                }
              }
            `}
          >
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <button data-active={currentView === "exercise-editor" && "1"}>exercise-editor</button>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <button data-active={currentView === "exercise" && "1"}>exercise</button>
            {/* eslint-disable-next-line i18next/no-literal-string */}
            <button data-active={currentView === "view-submission" && "1"}>view-submission</button>
          </div>
        </Area>
        {serviceInfoQuery.data &&
          isValidServiceInfo &&
          serviceInfoQuery.data.user_interface_iframe_path &&
          privateSpec && (
            <div
              className={css`
                margin-top: 1rem;
              `}
            >
              <MessageChannelIFrame
                key={iframeKey}
                url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}?width=${width}`}
                postThisStateToIFrame={{
                  // @ts-expect-error: this kind of approach is not nice with the IFrameState
                  view_type: currentView,
                  exercise_task_id: EXAMPLE_UUID,
                  data: {
                    private_spec: privateSpec,
                  },
                }}
                onMessageFromIframe={(msg) => {
                  setCurrentStateReceivedFromIframe(msg)
                }}
                title={TITLE}
                showBorders={showIframeBorders}
              />
            </div>
          )}
      </Area>

      <Area>
        <h2>{t("title-communication-with-the-iframe")}</h2>
      </Area>

      <Area>
        <h3>{t("title-current-state-received-from-the-iframe")}</h3>

        {currentStateReceivedFromIframe === null ? (
          <>{t("message-no-current-state-message-received-from-the-iframe-yet")}</>
        ) : (
          <>
            <pre>{JSON.stringify(currentStateReceivedFromIframe, undefined, 2)}</pre>
            {currentView === "exercise-editor" && (
              <Button
                size="medium"
                variant="primary"
                onClick={() => {
                  setValue(
                    "private_spec",
                    JSON.stringify(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (currentStateReceivedFromIframe?.data as any)?.private_spec,
                      undefined,
                      2,
                    ),
                  )
                }}
              >
                {t("button-set-as-private-spec-input")}
              </Button>
            )}
          </>
        )}
      </Area>
    </Layout>
  )
}

export default IframeViewPlayground
