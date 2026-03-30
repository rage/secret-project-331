"use client"

import i18n from "i18next"
import { cloneDeep } from "lodash"
import { orderBy } from "natural-orderby"
import { useRef, useState } from "react"
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

/**
 * Manages the iframe–parent protocol for the TMC exercise iframe.
 * Listens for: set-state, upload-result, repository-exercises, test-results, set-language.
 * set-state payloads include view_type (exercise-editor | answer-exercise | view-submission) and type-specific data.
 * Returns { port, state, testRequestResponse, fileUploadResponse, setStateAndSend, sendFileUploadMessage, requestRepositoryExercises }.
 */
export function useIframeProtocol() {
  const iframeIdRef = useRef(v4().slice(0, 4))
  const iframeId = iframeIdRef.current
  const latestPublicSpecRequestRef = useRef(0)

  const debug = (message: string, ...optionalParams: unknown[]): void => {
    console.debug(`[tmc-iframe/${iframeId}]`, message, ...optionalParams)
  }

  const logError = (message: string, ...optionalParams: unknown[]): void => {
    console.error(`[tmc-iframe/${iframeId}]`, message, ...optionalParams)
  }

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
      debug("Received message:", messageData)
      if (messageData.message === "set-state") {
        // flushSync ensures the parent HeightTrackingContainer can measure DOM height synchronously
        // after these state updates; without it updates may be deferred and height tracking would be wrong.
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
            const requestToken = ++latestPublicSpecRequestRef.current
            publicSpecToIframeUserAnswer(newPublicSpec)
              .then((userAnswer) => {
                if (requestToken !== latestPublicSpecRequestRef.current) {
                  return
                }
                const publicSpecClone = cloneDeep(newPublicSpec)
                const previousSubmission = messageData.data
                  .previous_submission as ExerciseTaskSubmission | null
                setState(() => ({
                  view_type: "answer-exercise" as const,
                  public_spec: publicSpecClone,
                  user_answer: userAnswer,
                  previous_submission: previousSubmission,
                }))
              })
              .catch((error) => {
                if (requestToken !== latestPublicSpecRequestRef.current) {
                  return
                }
                logError("Failed to process public spec", error)
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
            logError("Unknown view type received from parent")
          }
        })
      } else if (messageData.message === "upload-result") {
        setFileUploadResponse(messageData)
        if (messageData.success) {
          setStateAndSend(port, (old) => {
            if (old && old.view_type === "answer-exercise" && old.user_answer.type === "editor") {
              const urls = messageData.urls
              const archiveDownloadUrl =
                urls instanceof Map
                  ? (Array.from(urls.values())[0] ?? null)
                  : Array.isArray(urls)
                    ? (urls[0] ?? null)
                    : null
              return {
                ...old,
                user_answer: {
                  type: "editor",
                  archive_download_url: archiveDownloadUrl ?? "",
                },
              }
            } else {
              return old
            }
          })
        } else {
          logError("Failed to upload:", messageData.error)
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
      } else if (messageData.message === "set-language") {
        const language =
          (messageData as { language?: string }).language ??
          (messageData as { data?: { language?: string } }).data?.language
        if (typeof language === "string") {
          void i18n.changeLanguage(language)
        }
      } else {
        logError("Unexpected message from parent")
      }
    } else {
      logError("Frame received an unknown message from message port")
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
