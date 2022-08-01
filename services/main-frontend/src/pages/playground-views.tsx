import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faCheck, faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Layout from "../components/Layout"
import PlaygroundExerciseEditorIframe from "../components/page-specific/playground-views/PlaygroundExerciseEditorIframe"
import PlaygroundExerciseIframe from "../components/page-specific/playground-views/PlaygroundExerciseIframe"
import PlaygroundViewSubmissionIframe from "../components/page-specific/playground-views/PlaygroundViewSubmissionIframe"
import { ExerciseServiceInfoApi, ExerciseTaskGradingResult } from "../shared-module/bindings"
import { isExerciseServiceInfoApi } from "../shared-module/bindings.guard"
import Button from "../shared-module/components/Button"
import BreakFromCentered from "../shared-module/components/Centering/BreakFromCentered"
import DebugModal from "../shared-module/components/DebugModal"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import CheckBox from "../shared-module/components/InputFields/CheckBox"
import TextAreaField from "../shared-module/components/InputFields/TextAreaField"
import TextField from "../shared-module/components/InputFields/TextField"
import Spinner from "../shared-module/components/Spinner"
import {
  CurrentStateMessage,
  IframeViewType,
} from "../shared-module/exercise-service-protocol-types"
import { GradingRequest } from "../shared-module/exercise-service-protocol-types-2"
import useToastMutation from "../shared-module/hooks/useToastMutation"
import { baseTheme, monospaceFont } from "../shared-module/styles"
import { respondToOrLarger } from "../shared-module/styles/respond"

interface PlaygroundFields {
  url: string
  width: string
  private_spec: string
  showIframeBorders: boolean
}

const Area = styled.div`
  margin-bottom: 1rem;
`

// eslint-disable-next-line i18next/no-literal-string
const StyledPre = styled.pre`
  background-color: ${baseTheme.colors.clear[100]};
  border-radius: 6px;
  padding: 1rem;
  font-size: 14px;
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

const IframeViewPlayground: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()

  const [currentStateReceivedFromIframe, setCurrentStateReceivedFromIframe] =
    useState<CurrentStateMessage | null>(null)
  // eslint-disable-next-line i18next/no-literal-string
  const [currentView, setCurrentView] = useState<IframeViewType>("exercise-editor")
  const [submissionViewSendModelsolutionSpec, setSubmissionViewSendModelsolutionSpec] =
    useState(true)

  const { register, setValue, watch } = useForm<PlaygroundFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      // eslint-disable-next-line i18next/no-literal-string
      url: "http://project-331.local/example-exercise/api/service-info",
      width: "700",
      // eslint-disable-next-line i18next/no-literal-string
      private_spec: "null",
      showIframeBorders: true,
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

  const serviceInfoQuery = useQuery(
    [`iframe-view-playground-service-info-${url}`],
    async (): Promise<ExerciseServiceInfoApi> => {
      const res = await axios.get(url)
      return res.data
    },
  )

  const isValidServiceInfo = isExerciseServiceInfoApi(serviceInfoQuery.data)

  const publicSpecQuery = useQuery(
    [`iframe-view-playground-public-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`],
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

  const [userAnswer, setUserAnswer] = useState<unknown>(null)
  const submitAnswerMutation = useToastMutation<
    ExerciseTaskGradingResult,
    unknown,
    unknown,
    unknown
  >(
    async () => {
      if (
        !serviceInfoQuery.data ||
        !isValidServiceInfo ||
        currentStateReceivedFromIframe === null ||
        !privateSpecValidJson
      ) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("Requirements for the mutation not satisfied.")
      }
      const gradingRequest: GradingRequest = {
        exercise_spec: privateSpecParsed,
        submission_data: currentStateReceivedFromIframe.data,
      }
      setUserAnswer(currentStateReceivedFromIframe.data)
      const res = await axios.post(
        `${exerciseServiceHost}${serviceInfoQuery.data.grade_endpoint_path}`,
        gradingRequest,
      )
      return res.data
    },
    { notify: true, method: "POST" },
  )

  const modelSolutionSpecQuery = useQuery(
    [`iframe-view-playground-model-solution-spec-${url}-${serviceInfoQuery.data}-${privateSpec}`],
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
      <h1>{t("title-playground-exercise-iframe")}</h1>
      <br />

      <BreakFromCentered sidebar={false}>
        <GridContainer>
          <ServiceInfoUrlGridArea>
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
          </ServiceInfoUrlGridArea>
          <MiscSettingsGridArea>
            <TextField
              placeholder={t("label-width")}
              label={t("label-width")}
              register={register("width")}
            />
            <CheckBox label={t("show-iframe-borders")} register={register("showIframeBorders")} />
          </MiscSettingsGridArea>

          <PrivateSpecGridArea>
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
                  font-size: 14px !important;
                }
              `}
            />
          </PrivateSpecGridArea>

          <AnswerAndGradingGridArea>
            <Area>
              <h3>{t("title-user-answer")}</h3>

              {userAnswer ? (
                <StyledPre>{JSON.stringify(userAnswer, undefined, 2)}</StyledPre>
              ) : (
                <div>{t("error-no-user-answer")}</div>
              )}
            </Area>

            <Area>
              <h3>{t("title-grading")}</h3>

              {submitAnswerMutation.isSuccess && !submitAnswerMutation.isLoading ? (
                <StyledPre>{JSON.stringify(submitAnswerMutation.data, undefined, 2)}</StyledPre>
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

              {publicSpecQuery.isError && (
                <ErrorBanner variant={"readOnly"} error={publicSpecQuery.error} />
              )}
              {publicSpecQuery.isLoading && <Spinner variant={"medium"} />}
              {publicSpecQuery.fetchStatus === "idle" && (
                <p>{t("error-cannot-load-with-the-given-inputs")}</p>
              )}
              {publicSpecQuery.isSuccess && (
                <StyledPre>{JSON.stringify(publicSpecQuery.data, undefined, 2)}</StyledPre>
              )}
            </Area>
          </PublicSpecArea>

          <ModelSolutionSpecArea>
            <Area>
              <h3>{t("title-model-solution-spec")}</h3>

              <p>{t("model-solution-spec-explanation")}</p>

              {modelSolutionSpecQuery.isError && (
                <ErrorBanner variant={"readOnly"} error={modelSolutionSpecQuery.error} />
              )}
              {modelSolutionSpecQuery.isLoading && <Spinner variant={"medium"} />}
              {modelSolutionSpecQuery.fetchStatus === "idle" && (
                <p>{t("error-cannot-load-with-the-given-inputs")}</p>
              )}
              {modelSolutionSpecQuery.isSuccess && (
                <StyledPre>{JSON.stringify(modelSolutionSpecQuery.data, undefined, 2)}</StyledPre>
              )}
            </Area>
          </ModelSolutionSpecArea>
        </GridContainer>
      </BreakFromCentered>

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
              data-active={currentView === "exercise" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("exercise")
              }}
              // eslint-disable-next-line i18next/no-literal-string
            >
              exercise
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
        {serviceInfoQuery.data && isValidServiceInfo && serviceInfoQuery.data && privateSpec && (
          <>
            {currentView === "exercise-editor" && (
              <PlaygroundExerciseEditorIframe
                url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}?width=${width}`}
                privateSpec={privateSpec}
                setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                showIframeBorders={showIframeBorders}
              />
            )}
            {currentView === "exercise" && (
              <>
                <PlaygroundExerciseIframe
                  url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}?width=${width}`}
                  publicSpecQuery={publicSpecQuery}
                  setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                  showIframeBorders={showIframeBorders}
                />
                <Button
                  variant={"primary"}
                  size={"medium"}
                  disabled={
                    currentStateReceivedFromIframe === null || submitAnswerMutation.isLoading
                  }
                  onClick={() => submitAnswerMutation.mutate(undefined)}
                >
                  {t("button-text-submit")}
                </Button>
              </>
            )}
            {currentView === "view-submission" && (
              <>
                <CheckBox
                  // eslint-disable-next-line i18next/no-literal-string
                  label="Send model solution spec (happens when one has ran out of tries or gotten full points from the exercise)"
                  checked={submissionViewSendModelsolutionSpec}
                  onChange={() => {
                    setSubmissionViewSendModelsolutionSpec(!submissionViewSendModelsolutionSpec)
                  }}
                />
                <PlaygroundViewSubmissionIframe
                  url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}?width=${width}`}
                  publicSpecQuery={publicSpecQuery}
                  setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                  showIframeBorders={showIframeBorders}
                  gradingQuery={submitAnswerMutation}
                  modelSolutionSpecQuery={modelSolutionSpecQuery}
                  userAnswer={userAnswer}
                  sendModelsolutionSpec={submissionViewSendModelsolutionSpec}
                />
              </>
            )}
          </>
        )}
      </Area>

      <Area>
        <h2>{t("title-communication-with-the-iframe")}</h2>
      </Area>

      <Area>
        <div
          className={css`
            display: flex;
            h3 {
              margin-right: 0.5rem;
            }
          `}
        >
          <h3>{t("title-current-state-received-from-the-iframe")}</h3>{" "}
          <DebugModal data={currentStateReceivedFromIframe} buttonSize="small" />
        </div>
        {currentStateReceivedFromIframe === null ? (
          <>{t("message-no-current-state-message-received-from-the-iframe-yet")}</>
        ) : (
          <>
            <StyledPre>
              {JSON.stringify(currentStateReceivedFromIframe.data, undefined, 2)}
            </StyledPre>
            <div
              className={css`
                margin-bottom: 1rem;
              `}
            >
              {t("label-valid")}: {JSON.stringify(currentStateReceivedFromIframe.valid)}
            </div>
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
