"use client"

import _ from "lodash"
import { orderBy } from "natural-orderby"
import { useState } from "react"
import ReactDOM from "react-dom"
import { v4 } from "uuid"

import { ExerciseTaskSubmission } from "@/shared-module/common/bindings"
import { UploadResultMessage } from "@/shared-module/common/exercise-service-protocol-types"
import { isMessageToIframe } from "@/shared-module/common/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "@/shared-module/common/hooks/useExerciseServiceParentConnection"
import { RunResult } from "@/tmc/cli"
import { publicSpecToIframeUserAnswer } from "@/util/publicSpecToUserAnswer"
import {
  CurrentStateMessageData,
  ExerciseIframeState,
  MessageToParent,
  ModelSolutionSpec,
  PrivateSpec,
  PublicSpec,
  UserAnswer,
} from "@/util/stateInterfaces"

const iframeId = v4().slice(0, 4)

const debug = (_iframeId: string, message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[tmc-iframe/${_iframeId}]`, message, ...optionalParams)
}

const logError = (_iframeId: string, message: string, ...optionalParams: unknown[]): void => {
  console.error(`[tmc-iframe/${_iframeId}]`, message, ...optionalParams)
}

function sendSpecToParent(port: MessagePort, data: CurrentStateMessageData) {
  console.info("Posting message to parent")
  const currentStateMessage: MessageToParent = {
    message: "current-state",
    data,
    valid: true,
  }
  port.postMessage(currentStateMessage)
}

function sendFileUploadMsg(port: MessagePort | null, files: Map<string, string | Blob>) {
  if (port) {
    const fileUploadRequest: MessageToParent = { message: "file-upload", files }
    port.postMessage(fileUploadRequest)
  }
}

function requestRepoExercises(port: MessagePort | null) {
  if (port) {
    const msg: MessageToParent = { message: "request-repository-exercises" }
    port.postMessage(msg)
  }
}

export function useIframeProtocol() {
  const [state, setState] = useState<ExerciseIframeState | null>(null)
  const [testRequestResponse, setTestRequestResponse] = useState<RunResult | null>(null)
  const [fileUploadResponse, setFileUploadResponse] = useState<UploadResultMessage | null>(null)

  const setStateAndSend = (
    port: MessagePort | null,
    updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null,
  ) => {
    if (!port) {
      return
    }
    setState((old) => {
      const newState = updater(old)
      if (newState?.view_type === "exercise-editor" && newState.private_spec) {
        sendSpecToParent(port, { private_spec: newState.private_spec })
      } else if (newState?.view_type === "answer-exercise") {
        sendSpecToParent(port, { private_spec: newState.user_answer })
      } else if (newState?.view_type === "view-submission") {
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
            const newPublicSpec = messageData.data.public_spec as PublicSpec
            publicSpecToIframeUserAnswer(newPublicSpec)
              .then((userAnswer) => {
                setState((oldState) => {
                  const previousSubmission = messageData.data
                    .previous_submission as ExerciseTaskSubmission | null
                  return {
                    view_type: messageData.view_type,
                    public_spec:
                      oldState?.view_type === "answer-exercise"
                        ? oldState.public_spec
                        : _.cloneDeep(newPublicSpec),
                    user_answer: userAnswer,
                    previous_submission: previousSubmission,
                  }
                })
              })
              .catch((error) => {
                throw new Error(`Failed to process public spec: ${error}`)
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
            logError(iframeId, "Unknown view type received from parent")
          }
        })
      } else if (messageData.message === "upload-result") {
        setFileUploadResponse(messageData)
        if (messageData.success) {
          setStateAndSend(port, (old) => {
            if (old && old.view_type === "answer-exercise" && old.user_answer.type === "editor") {
              let archiveDownloadUrl = "null"
              messageData.urls.forEach((val) => {
                archiveDownloadUrl = val
              })
              return {
                ...old,
                user_answer: { type: "editor", archive_download_url: archiveDownloadUrl },
              }
            } else {
              return old
            }
          })
        } else {
          logError(iframeId, "Failed to upload:", messageData.error)
        }
      } else if (messageData.message === "repository-exercises") {
        setState((oldState) => {
          if (oldState && oldState.view_type === "exercise-editor") {
            const sorted = orderBy(messageData.repository_exercises, (re) => re.part + re.name)
            return { ...oldState, repository_exercises: sorted }
          } else {
            return oldState
          }
        })
      } else if (messageData.message === "test-results") {
        setTestRequestResponse(messageData.test_result as RunResult)
      } else {
        logError(iframeId, "Unexpected message from parent")
      }
    } else {
      logError(iframeId, "Frame received an unknown message from message port")
    }
  })

  return {
    port,
    state,
    testRequestResponse,
    fileUploadResponse,
    setStateAndSend: (updater: (s: ExerciseIframeState | null) => ExerciseIframeState | null) =>
      setStateAndSend(port, updater),
    sendFileUploadMessage: (filename: string, file: File) => {
      const files = new Map<string, string | Blob>()
      files.set(filename, file)
      sendFileUploadMsg(port, files)
    },
    requestRepositoryExercises: () => requestRepoExercises(port),
  }
}
