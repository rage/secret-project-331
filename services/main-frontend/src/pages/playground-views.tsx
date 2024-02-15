import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { isServer, useQuery } from "@tanstack/react-query"
import { BellXmark, CheckCircle, MoveUpDownArrows } from "@vectopus/atlas-icons-react"
import axios from "axios"
import _ from "lodash"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import PlaygroundExerciseEditorIframe from "../components/page-specific/playground-views/PlaygroundExerciseEditorIframe"
import PlaygroundExerciseIframe from "../components/page-specific/playground-views/PlaygroundExerciseIframe"
import PlaygroundViewSubmissionIframe from "../components/page-specific/playground-views/PlaygroundViewSubmissionIframe"
import {
  ExerciseServiceInfoApi,
  ExerciseTaskGradingResult,
  PlaygroundViewsMessage,
  SpecRequest,
} from "../shared-module/common/bindings"
import { isExerciseServiceInfoApi } from "../shared-module/common/bindings.guard"
import Button from "../shared-module/common/components/Button"
import BreakFromCentered from "../shared-module/common/components/Centering/BreakFromCentered"
import DebugModal from "../shared-module/common/components/DebugModal"
import ErrorBanner from "../shared-module/common/components/ErrorBanner"
import CheckBox from "../shared-module/common/components/InputFields/CheckBox"
import TextAreaField from "../shared-module/common/components/InputFields/TextAreaField"
import TextField from "../shared-module/common/components/InputFields/TextField"
import Spinner from "../shared-module/common/components/Spinner"
import HideChildrenInSystemTests from "../shared-module/common/components/system-tests/HideChildrenInSystemTests"
import {
  CurrentStateMessage,
  IframeViewType,
  UserInformation,
} from "../shared-module/common/exercise-service-protocol-types"
import { GradingRequest } from "../shared-module/common/exercise-service-protocol-types-2"
import useToastMutation from "../shared-module/common/hooks/useToastMutation"
import { baseTheme, monospaceFont } from "../shared-module/common/styles"
import { narrowContainerWidthPx } from "../shared-module/common/styles/constants"
import { respondToOrLarger } from "../shared-module/common/styles/respond"
import withErrorBoundary from "../shared-module/common/utils/withErrorBoundary"
import withNoSsr from "../shared-module/common/utils/withNoSsr"

interface PlaygroundFields {
  url: string
  private_spec: string
  showIframeBorders: boolean
  disableSandbox: boolean
  pseudonymousUserId: string
  signedIn: boolean
}

const Area = styled.div`
  margin-bottom: 1rem;
`

const FULL_WIDTH = "100vw"
const HALF_WIDTH = "50vw"

// eslint-disable-next-line i18next/no-literal-string
const StyledPre = styled.pre<{ fullWidth: boolean }>`
  background-color: rgba(218, 230, 229, 0.4);
  border-radius: 6px;
  padding: 1rem;
  font-size: 13px;
  max-width: ${(props) => (props.fullWidth ? FULL_WIDTH : HALF_WIDTH)};
  max-height: 700px;
  overflow: scroll;
  white-space: pre-wrap;
  resize: vertical;

  &[style*="height"] {
    max-height: unset;
  }
`

// eslint-disable-next-line i18next/no-literal-string
const GridContainer = styled.div`
  padding: 2rem;
  max-width: 1800px;
  margin: 0 auto;

  display: grid;
  grid-gap: 0;
  grid-template-rows: auto;
  grid-template-columns: 1fr;
  grid-template-areas:
    "service-info-url"
    "misc-settings"
    "private-spec"
    "answer-and-grading"
    "derived-specs-explanation"
    "derived-specs-explanation"
    "public-spec"
    "model-solution-spec";

  ${respondToOrLarger.xl} {
    grid-gap: 2rem;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "service-info-url misc-settings"
      "private-spec answer-and-grading"
      "derived-specs-explanation derived-specs-explanation"
      "public-spec model-solution-spec";
  }

  ${respondToOrLarger.xxxxxl} {
    padding: 4rem;
    grid-gap: 2rem;
    max-width: 5000px;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    grid-template-areas:
      "service-info-url service-info-url misc-settings misc-settings"
      "derived-specs-explanation derived-specs-explanation derived-specs-explanation derived-specs-explanation"
      "private-spec answer-and-grading public-spec model-solution-spec";
  }
`

const ServiceInfoUrlGridArea = styled.div`
  grid-area: service-info-url;
`

const MiscSettingsGridArea = styled.div`
  grid-area: misc-settings;
`

const PrivateSpecGridArea = styled.div`
  grid-area: private-spec;
`

const AnswerAndGradingGridArea = styled.div`
  grid-area: answer-and-grading;
`

const DerivedSpecsExplanationArea = styled.div`
  grid-area: derived-specs-explanation;
`

const PublicSpecArea = styled.div`
  grid-area: public-spec;
`

const ModelSolutionSpecArea = styled.div`
  grid-area: model-solution-spec;
`

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin
const WEBSOCKET_ADDRESS = PUBLIC_ADDRESS?.replace("http://", "ws://").replace("https://", "wss://")
const DEFAULT_SERVICE_INFO_URL = `${PUBLIC_ADDRESS}/example-exercise/api/service-info`

const IframeViewPlayground: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()

  const SCROLL_TARGETS = [
    { name: t("title-playground-exercise-iframe"), id: "heading-playground-exercise-iframe" },
    { name: t("private-spec"), id: "heading-private-spec" },
    { name: t("title-iframe"), id: "heading-iframe" },
    { name: t("title-communication-with-the-iframe"), id: "heading-communication-with-the-iframe" },
  ]

  const [currentStateReceivedFromIframe, setCurrentStateReceivedFromIframe] =
    useState<CurrentStateMessage | null>(null)
  // eslint-disable-next-line i18next/no-literal-string
  const [currentView, setCurrentView] = useState<IframeViewType>("exercise-editor")
  const [submissionViewSendModelsolutionSpec, setSubmissionViewSendModelsolutionSpec] =
    useState(true)
  const [answerExerciseViewSendPreviousSubmission, setAnswerExerciseViewSendPreviousSubmission] =
    useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const { register, setValue, watch } = useForm<PlaygroundFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      // eslint-disable-next-line i18next/no-literal-string
      url: localStorage.getItem("service-info-url") ?? DEFAULT_SERVICE_INFO_URL,
      // eslint-disable-next-line i18next/no-literal-string
      private_spec: "null",
      showIframeBorders: true,
      disableSandbox: false,
      // eslint-disable-next-line i18next/no-literal-string
      pseudonymousUserId: "78b62532-b836-4387-8f99-673cb023b903",
      signedIn: true,
    },
  })

  const url = watch("url")
  const privateSpec = watch("private_spec")
  const showIframeBorders = watch("showIframeBorders")
  const disableSandbox = watch("disableSandbox")
  const pseudonymousUserId = watch("pseudonymousUserId")
  const signedIn = watch("signedIn")

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

  const serviceInfoQuery = useQuery({
    queryKey: [`iframe-view-playground-service-info-${url}`],
    queryFn: async (): Promise<ExerciseServiceInfoApi> => {
      const res = await axios.get(url)
      return res.data
    },
  })

  const isValidServiceInfo = isExerciseServiceInfoApi(serviceInfoQuery.data)

  useEffect(() => {
    if (isValidServiceInfo) {
      // eslint-disable-next-line i18next/no-literal-string
      localStorage.setItem("service-info-url", url)
    }
  }, [isValidServiceInfo, url])

  const publicSpecQuery = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      `iframe-view-playground-public-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`,
      isValidServiceInfo,
      privateSpecValidJson,
      privateSpecParsed,
      exerciseServiceHost,
    ],
    queryFn: async (): Promise<unknown> => {
      if (!serviceInfoQuery.data || !isValidServiceInfo || !privateSpecValidJson) {
        throw new Error("This query should be disabled.")
      }
      const payload: SpecRequest = {
        request_id: v4(),
        private_spec: privateSpecParsed,
        upload_url: `${PUBLIC_ADDRESS}/api/v0/files/playground`,
      }
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.public_spec_endpoint_path}`,
        payload,
      )
      return res.data
    },
    enabled:
      serviceInfoQuery.isSuccess &&
      Boolean(serviceInfoQuery.data) &&
      isValidServiceInfo &&
      privateSpecValidJson,
    retry: false,
  })

  const [userAnswer, setUserAnswer] = useState<unknown>(null)
  type submitAnswerMutationParam =
    // Submits the data to the exercise service and sets the returned grading as the data
    | { type: "submit"; data: unknown }
    // Directly sets the grading received from a websocket as the mutation's data
    | { type: "fromWebsocket"; data: ExerciseTaskGradingResult }
  const submitAnswerMutation = useToastMutation<
    ExerciseTaskGradingResult,
    unknown,
    submitAnswerMutationParam,
    unknown
  >(
    async (param) => {
      if (param.type === "submit") {
        if (!serviceInfoQuery.data || !isValidServiceInfo || !privateSpecValidJson) {
          throw new Error("Requirements for the mutation not satisfied.")
        }
        const gradingRequest: GradingRequest = {
          // eslint-disable-next-line i18next/no-literal-string
          grading_update_url: `${PUBLIC_ADDRESS}/api/v0/main-frontend/playground-views/grading/${websocketId}`,
          exercise_spec: privateSpecParsed,
          submission_data: param.data,
        }
        setUserAnswer(param.data)
        const res = await axios.post(
          `${exerciseServiceHost}${serviceInfoQuery.data.grade_endpoint_path}`,
          gradingRequest,
        )
        return res.data
      } else if (param.type === "fromWebsocket") {
        return param.data
      } else {
        throw new Error("unreachable")
      }
    },
    { notify: true, method: "POST" },
  )

  const [websocket, setWebsocket] = useState<WebSocket | null>(null)
  const [websocketId, setWebsocketId] = useState<string | null>(null)
  useEffect(() => {
    // prevent creating unnecessary websocket connections
    if (websocket === null) {
      // eslint-disable-next-line i18next/no-literal-string
      setWebsocket(new WebSocket(`${WEBSOCKET_ADDRESS}/api/v0/main-frontend/playground-views/ws`))
      return
    }
    const ws = websocket
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as PlaygroundViewsMessage
      if (msg.tag == "TimedOut") {
        console.error("websocket timed out")
      } else if (msg.tag == "Registered") {
        console.info("Registered websocket", msg.data)
        setWebsocketId(msg.data)
      } else if (msg.tag == "ExerciseTaskGradingResult") {
        submitAnswerMutation.mutate({ type: "fromWebsocket", data: msg.data })
      } else {
        throw new Error(`Unexpected websocket message: ${ev}`)
      }
    }
    ws.onclose = (ev) => {
      console.error("websocket closed unexpectedly", ev)
    }
    ws.onerror = (err) => {
      console.error("websocket error", err)
    }
  }, [websocket, submitAnswerMutation])

  const modelSolutionSpecQuery = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: [
      `iframe-view-playground-model-solution-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`,
      isValidServiceInfo,
      privateSpecValidJson,
      privateSpecParsed,
      exerciseServiceHost,
    ],
    queryFn: async (): Promise<unknown> => {
      if (!serviceInfoQuery.data || !isValidServiceInfo || !privateSpecValidJson) {
        throw new Error("This query should be disabled.")
      }
      const payload: SpecRequest = {
        request_id: v4(),
        private_spec: privateSpecParsed,
        // eslint-disable-next-line i18next/no-literal-string
        upload_url: `${PUBLIC_ADDRESS}/api/v0/files/playground`,
      }
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.model_solution_spec_endpoint_path}`,
        payload,
      )
      return res.data
    },
    enabled:
      serviceInfoQuery.isSuccess &&
      Boolean(serviceInfoQuery.data) &&
      isValidServiceInfo &&
      privateSpecValidJson,
    retry: false,
  })

  const userInformation: UserInformation = {
    pseudonymous_id: pseudonymousUserId,
    signed_in: signedIn,
  }

  return (
    <>
      <h1 id="heading-playground-exercise-iframe">{t("title-playground-exercise-iframe")}</h1>
      <br />

      <BreakFromCentered sidebar={false}>
        <GridContainer>
          <ServiceInfoUrlGridArea>
            <TextField label={t("service-info-url")} {...register("url")} />
            {serviceInfoQuery.isError && t("error-fetching-service-info")}
            {!serviceInfoQuery.isPending && (
              <div
                className={css`
                  margin-top: -0.7rem;
                  margin-bottom: 0.2rem;
                  padding-left: 1rem;
                `}
              >
                {isValidServiceInfo ? (
                  <CheckCircle color={baseTheme.colors.green[400]} size={16} />
                ) : (
                  <BellXmark color={baseTheme.colors.red[500]} size={16} />
                )}

                <span
                  className={css`
                    margin: 0 0.5rem;
                  `}
                >
                  {isValidServiceInfo ? t("valid-service-info") : t("invalid-service-info")}
                </span>
                <DebugModal data={serviceInfoQuery.data} buttonSize="small" />
                {url !== DEFAULT_SERVICE_INFO_URL && (
                  <Button
                    variant={"secondary"}
                    size={"small"}
                    className={css`
                      margin-left: 0.5rem;
                    `}
                    onClick={() => {
                      setValue("url", DEFAULT_SERVICE_INFO_URL)
                    }}
                  >
                    {t("button-text-reset-url")}
                  </Button>
                )}
              </div>
            )}
          </ServiceInfoUrlGridArea>
          <MiscSettingsGridArea>
            <CheckBox label={t("show-iframe-borders")} {...register("showIframeBorders")} />
            <CheckBox label={t("disable-sandbox")} {...register("disableSandbox")} />
            <TextField
              placeholder={t("label-pseudonymous-user-id")}
              label={t("label-pseudonymous-user-id")}
              {...register("pseudonymousUserId")}
            />
            <CheckBox label={t("button-text-signed-in")} {...register("signedIn")} />
          </MiscSettingsGridArea>

          <PrivateSpecGridArea>
            <TextAreaField
              id="heading-private-spec"
              rows={20}
              spellCheck={false}
              label={t("private-spec")}
              {...register("private_spec", {
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
                  max-width: 50vw;
                  height: 700px;
                  font-family: ${monospaceFont} !important;
                  resize: vertical;
                  font-size: 13px !important;
                }
              `}
            />
          </PrivateSpecGridArea>

          <AnswerAndGradingGridArea>
            <Area>
              <div
                className={css`
                  display: flex;
                  h3 {
                    margin-right: 1rem;
                  }
                `}
              >
                <h3>{t("title-user-answer")}</h3>{" "}
                <DebugModal
                  data={userAnswer}
                  readOnly={false}
                  updateDataOnClose={(newValue) => {
                    submitAnswerMutation.mutate(newValue)
                  }}
                />
              </div>
              <p
                className={css`
                  margin-bottom: 0.5rem;
                `}
              >
                {t("user-answer-explanation")}
              </p>
              {userAnswer ? (
                <StyledPre fullWidth={false}>{JSON.stringify(userAnswer, undefined, 2)}</StyledPre>
              ) : (
                <div>{t("error-no-user-answer")}</div>
              )}
            </Area>

            <Area>
              <h3>{t("title-grading")}</h3>

              <p
                className={css`
                  margin-bottom: 0.5rem;
                `}
              >
                {t("grading-explanation")}
              </p>

              {submitAnswerMutation.isSuccess && !submitAnswerMutation.isPending ? (
                <StyledPre fullWidth={false}>
                  {JSON.stringify(submitAnswerMutation.data, undefined, 2)}
                </StyledPre>
              ) : (
                <div>{t("error-no-grading-long")}</div>
              )}
            </Area>
          </AnswerAndGradingGridArea>

          <DerivedSpecsExplanationArea>
            <Area>
              <h2>{t("title-derived-specs")}</h2>

              <p>{t("derived-specs-explanation")}</p>
            </Area>
          </DerivedSpecsExplanationArea>

          <PublicSpecArea>
            <Area>
              <h3>{t("title-public-spec")}</h3>

              <p>{t("public-spec-explanation")}</p>

              {publicSpecQuery.isError && <ErrorBanner error={publicSpecQuery.error} />}
              {publicSpecQuery.isPending && publicSpecQuery.isFetching && (
                <Spinner variant={"medium"} />
              )}
              {publicSpecQuery.isPending && !publicSpecQuery.isFetching && (
                <p>{t("error-cannot-load-with-the-given-inputs")}</p>
              )}
              {/* eslint-disable i18next/no-literal-string */}
              {publicSpecQuery.isSuccess && (
                <StyledPre fullWidth={false}>
                  {JSON.stringify(publicSpecQuery.data, undefined, 2).replaceAll("\\n", "\n")}
                </StyledPre>
              )}
              {/* eslint-enable i18next/no-literal-string */}
            </Area>
          </PublicSpecArea>

          <ModelSolutionSpecArea>
            <Area>
              <h3>{t("title-model-solution-spec")}</h3>

              <p>{t("model-solution-spec-explanation")}</p>

              {modelSolutionSpecQuery.isError && (
                <ErrorBanner error={modelSolutionSpecQuery.error} />
              )}
              {modelSolutionSpecQuery.isPending && modelSolutionSpecQuery.isFetching && (
                <Spinner variant={"medium"} />
              )}
              {modelSolutionSpecQuery.isPending && !modelSolutionSpecQuery.isFetching && (
                <p>{t("error-cannot-load-with-the-given-inputs")}</p>
              )}
              {/* eslint-disable i18next/no-literal-string */}
              {modelSolutionSpecQuery.isSuccess && (
                <StyledPre fullWidth={false}>
                  {JSON.stringify(modelSolutionSpecQuery.data, undefined, 2).replaceAll(
                    "\\n",
                    "\n",
                  )}
                </StyledPre>
              )}
              {/* eslint-enable i18next/no-literal-string */}
            </Area>
          </ModelSolutionSpecArea>
        </GridContainer>
      </BreakFromCentered>

      <Area>
        <div
          className={css`
            display: flex;
            align-items: center;
            h2 {
              margin-right: 1rem;
            }
            button {
              height: 40px;
            }
          `}
        >
          <h2 id="heading-iframe">{t("title-iframe")}</h2>{" "}
          <Button
            variant={"secondary"}
            size={"small"}
            onClick={() => {
              setRefreshKey((prev) => prev + 1)
            }}
          >
            {t("button-text-reload")}
          </Button>
        </div>
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
            <button
              data-active={currentView === "exercise-editor" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("exercise-editor")
              }}
              // eslint-disable-next-line i18next/no-literal-string
            >
              exercise-editor
            </button>
            <button
              data-active={currentView === "answer-exercise" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("answer-exercise")
              }}
              // eslint-disable-next-line i18next/no-literal-string
            >
              answer-exercise
            </button>
            <button
              data-active={currentView === "view-submission" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("view-submission")
              }}
              // eslint-disable-next-line i18next/no-literal-string
            >
              view-submission
            </button>
          </div>
        </Area>
        <div key={refreshKey}>
          {serviceInfoQuery.data && isValidServiceInfo && serviceInfoQuery.data && privateSpec && (
            <>
              {currentView === "exercise-editor" && (
                <PlaygroundExerciseEditorIframe
                  url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}`}
                  privateSpec={privateSpecParsed}
                  setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                  showIframeBorders={showIframeBorders}
                  disableSandbox={disableSandbox}
                  userInformation={userInformation}
                  repositoryExercises={[
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      id: "sample-exercise-1",
                      // eslint-disable-next-line i18next/no-literal-string
                      repository_id: "sample-repository-1",
                      // eslint-disable-next-line i18next/no-literal-string
                      part: "part01",
                      // eslint-disable-next-line i18next/no-literal-string
                      name: "ex01",
                      // eslint-disable-next-line i18next/no-literal-string
                      repository_url: "https://github.com/testmycode/tmc-testcourse",
                      checksum: [1, 2, 3, 4],
                      download_url:
                        // eslint-disable-next-line i18next/no-literal-string
                        `${PUBLIC_ADDRESS}/api/v0/files/playground-views/repository-exercise-1.tar.zst`,
                    },
                    {
                      // eslint-disable-next-line i18next/no-literal-string
                      id: "sample-exercise-2",
                      // eslint-disable-next-line i18next/no-literal-string
                      repository_id: "sample-repository-1",
                      // eslint-disable-next-line i18next/no-literal-string
                      part: "part01",
                      // eslint-disable-next-line i18next/no-literal-string
                      name: "ex02",
                      // eslint-disable-next-line i18next/no-literal-string
                      repository_url: "https://github.com/testmycode/tmc-testcourse",
                      checksum: [5, 6, 7, 8],
                      // eslint-disable-next-line i18next/no-literal-string
                      download_url:
                        // eslint-disable-next-line i18next/no-literal-string
                        `${PUBLIC_ADDRESS}/api/v0/files/playground-views/repository-exercise-2.tar.zst`,
                    },
                  ]}
                />
              )}
              {currentView === "answer-exercise" && (
                <>
                  <CheckBox
                    label={t("label-send-previous-submission")}
                    checked={answerExerciseViewSendPreviousSubmission}
                    onChange={() => {
                      setAnswerExerciseViewSendPreviousSubmission(
                        !answerExerciseViewSendPreviousSubmission,
                      )
                    }}
                  />
                  <PlaygroundExerciseIframe
                    url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}`}
                    publicSpecQuery={publicSpecQuery}
                    setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                    showIframeBorders={showIframeBorders}
                    disableSandbox={disableSandbox}
                    userInformation={userInformation}
                    userAnswer={answerExerciseViewSendPreviousSubmission ? userAnswer : null}
                  />
                  <Button
                    variant={"primary"}
                    size={"medium"}
                    disabled={
                      currentStateReceivedFromIframe === null || submitAnswerMutation.isPending
                    }
                    onClick={() => {
                      if (!currentStateReceivedFromIframe) {
                        throw new Error("No current state received from the iframe")
                      }
                      submitAnswerMutation.mutate({
                        type: "submit",
                        data: currentStateReceivedFromIframe.data,
                      })
                    }}
                  >
                    {t("button-text-submit")}
                  </Button>
                </>
              )}
              {currentView === "view-submission" && (
                <>
                  <CheckBox
                    label={t("label-send-model-solution-spec")}
                    checked={submissionViewSendModelsolutionSpec}
                    onChange={() => {
                      setSubmissionViewSendModelsolutionSpec(!submissionViewSendModelsolutionSpec)
                    }}
                  />
                  <PlaygroundViewSubmissionIframe
                    url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}`}
                    publicSpecQuery={publicSpecQuery}
                    setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                    showIframeBorders={showIframeBorders}
                    gradingQuery={submitAnswerMutation}
                    modelSolutionSpecQuery={modelSolutionSpecQuery}
                    userAnswer={userAnswer}
                    sendModelsolutionSpec={submissionViewSendModelsolutionSpec}
                    disableSandbox={disableSandbox}
                    userInformation={userInformation}
                  />
                </>
              )}
            </>
          )}
        </div>
      </Area>

      <Area>
        <h2 id="heading-communication-with-the-iframe">
          {t("title-communication-with-the-iframe")}
        </h2>
      </Area>

      <Area>
        <div
          className={css`
            display: flex;
            align-items: center;
            h3 {
              margin-right: 0.5rem;
            }
          `}
        >
          <h3>{t("title-current-state-received-from-the-iframe")}</h3>
          <DebugModal data={currentStateReceivedFromIframe} buttonSize="small" />
          {currentStateReceivedFromIframe && (
            <div
              className={css`
                margin: 0 1rem;
                flex-grow: 1;
              `}
            >
              {t("label-valid")}: {JSON.stringify(currentStateReceivedFromIframe.valid)}
            </div>
          )}

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
                // Must also reset the user answer because if the spec has changed, the user answer format is likely to be much different and not resetting it now would lead to hard-to-debug errors.
                setUserAnswer(null)
              }}
            >
              {t("button-set-as-private-spec-input")}
            </Button>
          )}
        </div>
        {currentStateReceivedFromIframe === null ? (
          <>{t("message-no-current-state-message-received-from-the-iframe-yet")}</>
        ) : (
          <>
            <StyledPre fullWidth>
              {JSON.stringify(currentStateReceivedFromIframe.data, undefined, 2)}
            </StyledPre>
          </>
        )}
      </Area>

      <HideChildrenInSystemTests>
        <div
          className={css`
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 50px;
            height: 50px;
            background-color: black;
            border: 2px solid black;
            z-index: 500;
            border-radius: 100px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;

            svg {
              color: white;
            }

            &:hover {
              background-color: white;
              cursor: pointer;
              svg {
                color: black;
              }
            }
          `}
        >
          <div
            className={css`
              position: relative;
              display: flex;
              justify-content: center;
              align-items: center;
            `}
          >
            <MoveUpDownArrows />
            <select
              name="pets"
              id="pet-select"
              className={css`
                height: 50px;
                width: 50px;
                opacity: 0;
                cursor: pointer;
                position: absolute;
                top: -12px;
                left: -12px;
              `}
              title={t("title-scroll-to-a-heading-in-this-page")}
              onChange={(event) => {
                const element = document.getElementById(event.target.value)
                if (!element) {
                  console.error("Element to scroll to not found", event.target.value)
                  return
                }
                const y = element.getBoundingClientRect().top + window.scrollY - 30
                window.scroll({ top: y, behavior: "smooth" })
              }}
            >
              {SCROLL_TARGETS.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </HideChildrenInSystemTests>
    </>
  )
}

export default withErrorBoundary(withNoSsr(IframeViewPlayground))
