/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import _ from "lodash"
import { useRouter } from "next/router"
import React, { useState } from "react"
import ReactDOM from "react-dom"
import { v4 } from "uuid"

import StateRenderer from "../components/StateRenderer"
import {
  CurrentStateMessageData,
  EditorExercisePublicSpec,
  ExerciseIframeState,
  MessageToParent,
  ModelSolutionSpec,
  PrivateSpec,
  PublicSpec,
  UserAnswer,
} from "../util/stateInterfaces"

import { ExerciseTaskSubmission } from "@/shared-module/common/bindings"
import HeightTrackingContainer from "@/shared-module/common/components/HeightTrackingContainer"
import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageToIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "@/shared-module/common/hooks/useExerciseServiceParentConnection"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const Iframe: React.FC<React.PropsWithChildren<unknown>> = () => {
  const iframeId = v4().slice(0, 4)

  const [state, setState] = useState<ExerciseIframeState | null>(null)
  const [fileUploadResponse, setFileUploadResponse] = useState<UploadResultMessage | null>(null)
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = 500
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  const setStateAndSend = (
    port: MessagePort | null,
    updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null,
  ) => {
    if (!port) {
      return
    }
    setState((old) => {
      const newState = updater(old)
      if (newState?.view_type == "exercise-editor" && newState.private_spec) {
        // send updated private spec
        sendSpecToParent(port, { private_spec: newState.private_spec })
      } else if (newState?.view_type == "answer-exercise") {
        // send user answer
        sendSpecToParent(port, { private_spec: newState.user_answer })
      } else if (newState?.view_type == "view-submission") {
        sendSpecToParent(port, { private_spec: newState.submission })
      }
      return newState
    })
  }

  const port = useExerciseServiceParentConnection((messageData, port) => {
    if (isMessageToIframe(messageData)) {
      debug(iframeId, "Received message:", messageData)
      if (messageData.message === "set-state") {
        ReactDOM.flushSync(() => {
          if (messageData.view_type === "exercise-editor") {
            setState({
              view_type: messageData.view_type,
              exercise_task_id: messageData.exercise_task_id,
              repository_exercises: messageData.repository_exercises || null,
              private_spec: messageData.data.private_spec as PrivateSpec,
            })
          } else if (messageData.view_type === "answer-exercise") {
            setState((oldState) => {
              const newPublicSpec = messageData.data.public_spec as EditorExercisePublicSpec
              const previousSubmission = messageData.data
                .previous_submission as ExerciseTaskSubmission | null
              return {
                view_type: messageData.view_type,
                initial_public_spec:
                  oldState?.view_type === "answer-exercise"
                    ? oldState.initial_public_spec
                    : // cloneDeep prevents setState from changing the initial spec
                      _.cloneDeep(newPublicSpec),
                user_answer: publicSpecToTemplateUserAnswer(newPublicSpec),
                previous_submission: previousSubmission,
              }
            })
          } else if (messageData.view_type === "view-submission") {
            setState({
              view_type: messageData.view_type,
              exercise_task_id: messageData.exercise_task_id,
              grading: messageData.data.grading,
              submission: messageData.data.user_answer as UserAnswer,
              public_spec: messageData.data.public_spec as PublicSpec,
              model_solution_spec: messageData.data.model_solution_spec as ModelSolutionSpec,
            })
          } else {
            error(iframeId, "Unknown view type received from parent")
          }
        })
      } else if (messageData.message === "upload-result") {
        setFileUploadResponse(messageData)
        if (messageData.success) {
          // using the wrapper here because we want to let the frontend know
          setStateAndSend(port, (old) => {
            if (old && old.view_type === "answer-exercise" && old.user_answer.type === "editor") {
              const state = { ...old }
              let archiveDownloadUrl = "null"
              messageData.urls.forEach((val) => {
                archiveDownloadUrl = val
              })
              state.user_answer = {
                type: "editor",
                archive_download_url: archiveDownloadUrl,
              }
              return state
            } else {
              // unexpected upload-result
              // todo: report error
              return old
            }
          })
        } else {
          error(iframeId, "Failed to upload:", messageData.error)
        }
      } else {
        error(iframeId, "Unexpected message from parent")
      }
    } else {
      error(iframeId, "Frame received an unknown message from message port")
    }
  })

  return (
    <HeightTrackingContainer port={port}>
      <div
        className={css`
          width: 100%;
          ${maxWidth && `max-width: ${maxWidth}px;`}
          margin: 0 auto;
        `}
      >
        <StateRenderer
          setState={(updater) => setStateAndSend(port, updater)}
          state={state}
          sendFileUploadMessage={(filename, file) => {
            const files = new Map()
            files.set(filename, file)
            sendFileUploadMessage(port, files)
          }}
          fileUploadResponse={fileUploadResponse}
        />
      </div>
    </HeightTrackingContainer>
  )
}

const sendSpecToParent = (port: MessagePort, data: CurrentStateMessageData) => {
  console.info("Posting message to parent")

  const currentStateMessage: MessageToParent = {
    message: "current-state",
    data,
    // we never construct invalid data
    valid: true,
  }
  port.postMessage(currentStateMessage)
}

const sendFileUploadMessage = (port: MessagePort | null, files: Map<string, string | Blob>) => {
  if (port) {
    const fileUploadRequest: MessageToParent = {
      message: "file-upload",
      files,
    }
    port.postMessage(fileUploadRequest)
  }
}

const publicSpecToTemplateUserAnswer = (publicSpec: PublicSpec): UserAnswer => {
  if (publicSpec.type == "browser") {
    return { type: "browser", files: publicSpec.files }
  } else if (publicSpec.type == "editor") {
    return { type: "editor", archive_download_url: publicSpec.archive_download_url }
  } else {
    throw new Error("unreachable")
  }
}

const debug = (iframeId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[tmc-iframe/${iframeId}]`, message, ...optionalParams)
}

const error = (requestId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[tmc-iframe/${requestId}]`, message, ...optionalParams)
}

export default withErrorBoundary(Iframe)
