import { changeLanguage } from "i18next"
import { cloneDeep } from "lodash"
import { orderBy } from "natural-orderby"
import { useEffect, useRef, useState } from "react"
import ReactDOM from "react-dom"
import { useDebounce } from "use-debounce"
import { v4 } from "uuid"

import type { UploadResultMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"
import { isMessageToIframe } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import useExerciseServiceParentConnection from "@/shared-module/exercise-react/react/hooks/useExerciseServiceParentConnection"
import type { RunResult } from "@/tmc/cli"
import { fetchArchiveFiles, initialEditorFiles, packBrowserAnswer } from "@/util/answerArchive"
import type { ExerciseTaskSubmission } from "@/util/exerciseServiceApi"
import type {
  ExerciseFile,
  ExerciseIframeState,
  MessageToParent,
  ModelSolutionSpec,
  PrivateSpec,
  PublicSpec,
} from "@/util/stateInterfaces"

/**
 * How long the browser editor must be idle before its files are packed and uploaded. Every pack
 * costs a round trip and a stored upload, so keystroke bursts have to collapse into one.
 */
const PACK_IDLE_MS = 2500

/**
 * What went wrong with the answer's archive: reading the one the editor starts from, or storing the
 * edited one. Either leaves the answer unsubmittable until a retry succeeds.
 */
export type AnswerArchiveError = "load" | "save"

/**
 * The current state of the iframe as the parent needs it: the answer's archive, or nothing yet.
 *
 * An answer names its archive in `files` and carries no data of its own. Null means this view has
 * no current state to report.
 */
export function currentStateMessage(state: ExerciseIframeState | null): MessageToParent | null {
  if (state?.view_type === "exercise-editor") {
    return state.private_spec === null
      ? null
      : { message: "current-state", data: { private_spec: state.private_spec }, valid: true }
  }
  if (state?.view_type === "answer-exercise") {
    const archiveId = state.uploaded_archive_id
    if (archiveId === null) {
      return { message: "current-state", data: null, valid: false }
    }
    return { message: "current-state", data: null, files: [archiveId], valid: true }
  }
  return null
}

function sendFileUploadMsg(port: MessagePort | null, files: readonly File[]): string | null {
  if (!port) {
    return null
  }
  const requestId = v4()
  const fileUploadRequest: MessageToParent = {
    message: "file-upload",
    requestId,
    files: [...files],
  }
  port.postMessage(fileUploadRequest)
  return requestId
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
 *
 * An answer is one uploaded archive: browser edits are packed and uploaded after a short idle
 * (see {@link PACK_IDLE_MS}) and the answer stays invalid until that upload's id is in hand.
 */
export function useIframeProtocol() {
  const iframeIdRef = useRef(v4().slice(0, 4))
  const iframeId = iframeIdRef.current
  const latestPublicSpecRequestRef = useRef(0)
  const latestSubmissionRequestRef = useRef(0)
  const pendingFileUploadRequestIdRef = useRef<string | null>(null)
  const packedFilesRef = useRef<ExerciseFile[] | null>(null)
  const latestPackRequestRef = useRef(0)

  const debug = (message: string, ...optionalParams: unknown[]): void => {
    console.debug(`[tmc-iframe/${iframeId}]`, message, ...optionalParams)
  }

  const logError = (message: string, ...optionalParams: unknown[]): void => {
    console.error(`[tmc-iframe/${iframeId}]`, message, ...optionalParams)
  }

  const [state, setState] = useState<ExerciseIframeState | null>(null)
  const [testRequestResponse, setTestRequestResponse] = useState<RunResult | null>(null)
  const [fileUploadResponse, setFileUploadResponse] = useState<UploadResultMessage | null>(null)
  const [archiveError, setArchiveError] = useState<AnswerArchiveError | null>(null)
  const [saveAttempt, setSaveAttempt] = useState(0)
  const retrySeedRef = useRef<(() => void) | null>(null)

  const setStateAndSend = (
    port: MessagePort | null,
    updater: (state: ExerciseIframeState | null) => ExerciseIframeState | null,
  ) => {
    if (!port) {
      return
    }
    setState((old) => {
      const newState = updater(old)
      const message = currentStateMessage(newState)
      if (message) {
        console.info("Posting message to parent")
        port.postMessage(message)
      }
      return newState
    })
  }

  const port = useExerciseServiceParentConnection((messageData, messagePort) => {
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
            const previousArchive = messageData.data.previous_submission_files?.[0] ?? null
            const requestToken = ++latestPublicSpecRequestRef.current
            const seed = async () => {
              try {
                const editorFiles = await initialEditorFiles(
                  newPublicSpec,
                  previousArchive?.url ?? null,
                )
                if (requestToken !== latestPublicSpecRequestRef.current) {
                  return
                }
                const publicSpecClone = cloneDeep(newPublicSpec)
                const previousSubmission = messageData.data
                  .previous_submission as ExerciseTaskSubmission | null
                setStateAndSend(messagePort, () => ({
                  view_type: "answer-exercise" as const,
                  public_spec: publicSpecClone,
                  editor_files: editorFiles,
                  // The previous archive is already a complete answer, so adopting it lets the
                  // student resubmit unchanged prior work in both modes.
                  uploaded_archive_id: previousArchive?.id ?? null,
                  previous_submission: previousSubmission,
                }))
              } catch (error) {
                if (requestToken === latestPublicSpecRequestRef.current) {
                  logError("Failed to process public spec", error)
                  setArchiveError("load")
                }
              }
            }
            retrySeedRef.current = () => {
              setArchiveError(null)
              void seed()
            }
            setArchiveError(null)
            void seed()
          } else if (messageData.view_type === "view-submission") {
            const publicSpec = messageData.data.public_spec as PublicSpec
            const archive = messageData.data.user_answer_files?.[0]
            const requestToken = ++latestSubmissionRequestRef.current
            setState({
              view_type: messageData.view_type,
              exercise_task_id: messageData.exercise_task_id,
              grading: messageData.data.grading,
              submitted_files: [],
              submitted_archive_url: archive?.url ?? null,
              public_spec: publicSpec,
              model_solution_spec: messageData.data.model_solution_spec as ModelSolutionSpec,
            })
            if (archive) {
              const showSubmittedFiles = async () => {
                try {
                  const submittedFiles = await fetchArchiveFiles(archive.url)
                  if (requestToken !== latestSubmissionRequestRef.current) {
                    return
                  }
                  setState((old) =>
                    old?.view_type === "view-submission"
                      ? { ...old, submitted_files: submittedFiles }
                      : old,
                  )
                } catch (error) {
                  logError("Failed to read the submitted archive", error)
                }
              }
              void showSubmittedFiles()
            }
          } else {
            logError("Unknown view type received from parent")
          }
        })
      } else if (messageData.message === "upload-result") {
        if (messageData.requestId !== pendingFileUploadRequestIdRef.current) {
          debug("Ignoring upload result for an unknown request", messageData.requestId)
          return
        }
        pendingFileUploadRequestIdRef.current = null
        setFileUploadResponse(messageData)
        if (messageData.success) {
          const uploadedFile = messageData.files[0]
          if (!uploadedFile) {
            logError("Upload succeeded without a stored file result")
            setArchiveError("save")
            return
          }
          const packedFiles = packedFilesRef.current
          setArchiveError(null)
          setStateAndSend(messagePort, (old) => {
            if (old?.view_type !== "answer-exercise") {
              return old
            }
            if (packedFiles !== null && packedFiles !== old.editor_files) {
              // A newer pack is on its way; this archive would report work the student has
              // already moved past.
              return old
            }
            return { ...old, uploaded_archive_id: uploadedFile.id }
          })
        } else {
          logError("Failed to upload:", messageData.error)
          setArchiveError("save")
        }
      } else if (messageData.message === "repository-exercises") {
        setState((oldState) => {
          if (oldState && oldState.view_type === "exercise-editor") {
            const sorted = orderBy(messageData.repository_exercises, (re) => re.part + re.name)
            return { ...oldState, repository_exercises: sorted }
          }
          return oldState
        })
      } else if (messageData.message === "test-results") {
        setTestRequestResponse(messageData.test_result as RunResult)
      } else if (messageData.message === "set-language") {
        const language =
          (messageData as { language?: string }).language ??
          (messageData as { data?: { language?: string } }).data?.language
        if (typeof language === "string") {
          void changeLanguage(language)
        }
      } else {
        logError("Unexpected message from parent")
      }
    } else {
      logError("Frame received an unknown message from message port")
    }
  })

  const filesToPack =
    state?.view_type === "answer-exercise" && state.uploaded_archive_id === null
      ? state.editor_files
      : null
  const [debouncedFilesToPack] = useDebounce(filesToPack, PACK_IDLE_MS)

  useEffect(() => {
    if (debouncedFilesToPack === null || debouncedFilesToPack.length === 0) {
      return
    }
    const packToken = ++latestPackRequestRef.current
    const packAndUpload = async () => {
      try {
        const archive = await packBrowserAnswer(debouncedFilesToPack)
        if (packToken !== latestPackRequestRef.current) {
          return
        }
        packedFilesRef.current = debouncedFilesToPack
        pendingFileUploadRequestIdRef.current = sendFileUploadMsg(port, [archive])
      } catch (error) {
        if (packToken !== latestPackRequestRef.current) {
          return
        }
        logError("Failed to pack the answer for upload", error)
        setArchiveError("save")
      }
    }
    setArchiveError(null)
    void packAndUpload()
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- run per debounced edit and per retry, not per render
  }, [debouncedFilesToPack, saveAttempt])

  return {
    port,
    state,
    testRequestResponse,
    fileUploadResponse,
    archiveError,
    retryArchiveOperation: () => {
      if (archiveError === "load") {
        retrySeedRef.current?.()
      } else {
        setSaveAttempt((attempt) => attempt + 1)
      }
    },
    setStateAndSend: (updater: (s: ExerciseIframeState | null) => ExerciseIframeState | null) =>
      setStateAndSend(port, updater),
    setAnswerFiles: (files: ExerciseFile[]) =>
      setStateAndSend(port, (old) =>
        old?.view_type === "answer-exercise"
          ? { ...old, editor_files: files, uploaded_archive_id: null }
          : old,
      ),
    sendFileUploadMessage: (file: File) => {
      packedFilesRef.current = null
      pendingFileUploadRequestIdRef.current = sendFileUploadMsg(port, [file])
    },
    requestRepositoryExercises: () => requestRepoExercises(port),
  }
}
