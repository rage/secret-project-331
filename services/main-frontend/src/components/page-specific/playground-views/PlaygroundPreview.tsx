// This page is not translated because this page is a development tool and using different languages here would just create confusing terminology and weird language.
/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { isServer, UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useState } from "react"
import { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { UseParsedPrivateSpecResult } from "../../../hooks/playground/useParsedPrivateSpec"
import { PlaygroundSettings } from "../../../pages/playground-tabs"

import PlaygroundExerciseEditorIframe from "./PlaygroundExerciseEditorIframe"
import PlaygroundExerciseIframe from "./PlaygroundExerciseIframe"
import PlaygroundViewSubmissionIframe from "./PlaygroundViewSubmissionIframe"

import { ExerciseServiceInfoApi, ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import DebugModal from "@/shared-module/common/components/DebugModal"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import {
  CurrentStateMessage,
  IframeViewType,
  UserInformation,
} from "@/shared-module/common/exercise-service-protocol-types"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const PUBLIC_ADDRESS = isServer ? "https://courses.mooc.fi" : new URL(window.location.href).origin

interface PlaygroundPreviewProps {
  serviceInfoQuery: UseQueryResult<ExerciseServiceInfoApi, unknown>
  isValidServiceInfo: boolean
  exerciseServiceHost: string
  parsedPrivateSpec: UseParsedPrivateSpecResult
  publicSpecQuery: UseQueryResult<unknown, unknown>
  modelSolutionSpecQuery: UseQueryResult<unknown, unknown>
  userAnswer: unknown
  setUserAnswer: (answer: unknown) => void
  // Caused weird type errors when the parameter generic was set to unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  submitAnswerMutation: UseMutationResult<ExerciseTaskGradingResult, unknown, any, unknown>
  settingsForm: UseFormReturn<PlaygroundSettings>
}

const FULL_WIDTH = "100vw"
const HALF_WIDTH = "50vw"

const StyledPre = styled.pre<{ fullWidth: boolean }>`
  background-color: rgba(218, 230, 229, 0.4);
  border-radius: 6px;
  padding: 1rem;
  font-size: 13px;
  max-width: ${(props) => (props.fullWidth ? FULL_WIDTH : HALF_WIDTH)};
  max-height: 700px;
  overflow: auto;
  white-space: pre-wrap;
  resize: vertical;

  &[style*="height"] {
    max-height: unset;
  }
`

const CheckBoxWrapper = styled.div`
  margin: 0.5rem;
`

const PlaygroundPreview: React.FC<PlaygroundPreviewProps> = ({
  serviceInfoQuery,
  isValidServiceInfo,
  exerciseServiceHost,
  parsedPrivateSpec,
  publicSpecQuery,
  modelSolutionSpecQuery,
  userAnswer,
  setUserAnswer,
  submitAnswerMutation,
  settingsForm,
}) => {
  const { t } = useTranslation()
  const width = settingsForm.watch("width")
  const showIframeBorders = settingsForm.watch("showIframeBorders")
  const disableSandbox = settingsForm.watch("disableSandbox")
  const pseudonymousUserId = settingsForm.watch("pseudonymousUserId")
  const signedIn = settingsForm.watch("signedIn")

  const userInformation: UserInformation = {
    pseudonymous_id: pseudonymousUserId,
    signed_in: signedIn,
  }

  const [currentView, setCurrentView] = useState<IframeViewType>("exercise-editor")

  // Makes the refresh button work
  const [refreshKey, setRefreshKey] = useState(0)
  const [currentStateReceivedFromIframe, setCurrentStateReceivedFromIframe] =
    useState<CurrentStateMessage | null>(null)
  const [answerExerciseViewSendPreviousSubmission, setAnswerExerciseViewSendPreviousSubmission] =
    useState(false)
  const [submissionViewSendModelsolutionSpec, setSubmissionViewSendModelsolutionSpec] =
    useState(false)

  return (
    <div>
      <div>
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
            margin: 0.5rem 1rem;
          `}
        >
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
        <div>
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
            >
              exercise-editor
            </button>
            <button
              data-active={currentView === "answer-exercise" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("answer-exercise")
              }}
            >
              answer-exercise
            </button>
            <button
              data-active={currentView === "view-submission" && "1"}
              onClick={() => {
                setCurrentStateReceivedFromIframe(null)
                setCurrentView("view-submission")
              }}
            >
              view-submission
            </button>
          </div>
        </div>
        <div
          key={refreshKey}
          className={css`
            margin: 0 auto;
            max-width: ${width}px;
          `}
        >
          {serviceInfoQuery.data &&
            isValidServiceInfo &&
            serviceInfoQuery.data &&
            parsedPrivateSpec && (
              <>
                {currentView === "exercise-editor" && (
                  <PlaygroundExerciseEditorIframe
                    url={`${exerciseServiceHost}${serviceInfoQuery.data.user_interface_iframe_path}`}
                    privateSpec={parsedPrivateSpec.parsedPrivateSpec}
                    setCurrentStateReceivedFromIframe={setCurrentStateReceivedFromIframe}
                    showIframeBorders={showIframeBorders}
                    disableSandbox={disableSandbox}
                    userInformation={userInformation}
                    repositoryExercises={[
                      {
                        id: "sample-exercise-1",

                        repository_id: "sample-repository-1",

                        part: "part01",

                        name: "ex01",

                        repository_url: "https://github.com/testmycode/tmc-testcourse",
                        checksum: [1, 2, 3, 4],
                        download_url: `${PUBLIC_ADDRESS}/api/v0/files/playground-views/repository-exercise-1.tar.zst`,
                      },
                      {
                        id: "sample-exercise-2",

                        repository_id: "sample-repository-1",

                        part: "part01",

                        name: "ex02",

                        repository_url: "https://github.com/testmycode/tmc-testcourse",
                        checksum: [5, 6, 7, 8],

                        download_url: `${PUBLIC_ADDRESS}/api/v0/files/playground-views/repository-exercise-2.tar.zst`,
                      },
                    ]}
                  />
                )}
                {currentView === "answer-exercise" && (
                  <>
                    <CheckBoxWrapper>
                      <CheckBox
                        label={t("label-send-previous-submission")}
                        checked={answerExerciseViewSendPreviousSubmission}
                        onChange={() => {
                          setAnswerExerciseViewSendPreviousSubmission(
                            !answerExerciseViewSendPreviousSubmission,
                          )
                        }}
                      />
                    </CheckBoxWrapper>
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
                    <CheckBoxWrapper>
                      <CheckBox
                        label={t("label-send-model-solution-spec")}
                        checked={submissionViewSendModelsolutionSpec}
                        onChange={() => {
                          setSubmissionViewSendModelsolutionSpec(
                            !submissionViewSendModelsolutionSpec,
                          )
                        }}
                      />
                    </CheckBoxWrapper>
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
      </div>
      <div
        className={css`
          padding: 2rem;
          padding-top: 0;
        `}
      >
        <div>
          <h2 id="heading-communication-with-the-iframe">
            {t("title-communication-with-the-iframe")}
          </h2>
        </div>

        <div>
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
                  settingsForm.setValue(
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
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(PlaygroundPreview)
