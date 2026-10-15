"use client"

import React from "react"

import { DialogApiContext, DialogDepthContext } from "./dialogContext"
import { dialogQueueReducer, emptyDialogQueue, hasSuccessor, isDialogOpen } from "./dialogQueue"
import type {
  AlertRequest,
  AnyDialogRequest,
  ConfirmRequest,
  CustomPromptRequest,
  DialogApi,
  DialogEntry,
  DialogKind,
  PromptResult,
  TextPromptRequest,
} from "./dialogRequests"
import { dismissedResult, normalizeRequest } from "./dialogRequests"
import { QueuedDialog } from "./QueuedDialog"

export const NO_DIALOG_PROVIDER_ERROR = "useDialog must be used within a DialogProvider"
export const NO_DOCUMENT_ERROR =
  "Dialogs cannot be opened while rendering on the server; call alert, confirm or prompt from an event handler or an effect"

type RequestDialog = (
  kind: DialogKind,
  depth: number,
  request: AnyDialogRequest,
) => Promise<unknown>

const ALERT_KIND: DialogKind = "alert"
const CONFIRM_KIND: DialogKind = "confirm"
const PROMPT_KIND: DialogKind = "prompt"

export interface DialogProviderProps {
  children: React.ReactNode
}

/**
 * Hosts the imperative dialogs that `useDialog` opens. Mount it once, inside `I18nProvider` so
 * react-aria picks up the same locale as the rest of the app.
 *
 * Nothing is rendered until a dialog is requested, and dialogs are client-only: react-aria portals
 * them to `document.body` and renders nothing during SSR. Every promise still outstanding when the
 * provider unmounts resolves as dismissed rather than hanging.
 */
export const DialogProvider: React.FC<DialogProviderProps> = ({ children }) => {
  const [queue, dispatch] = React.useReducer(dialogQueueReducer, emptyDialogQueue)
  const nextIdRef = React.useRef(0)
  const unsettledRef = React.useRef(new Set<DialogEntry>())
  const apisByDepthRef = React.useRef(new Map<number, DialogApi>())

  React.useEffect(() => {
    const unsettled = unsettledRef.current
    return () => {
      for (const entry of unsettled) {
        entry.resolve(dismissedResult(entry.kind))
      }
      unsettled.clear()
    }
  }, [])

  const settle = React.useCallback((entry: DialogEntry, result: unknown) => {
    if (!unsettledRef.current.delete(entry)) {
      return
    }
    entry.resolve(result)
    dispatch({ type: "close", id: entry.id })
  }, [])

  const handleExitComplete = React.useCallback((id: number) => {
    dispatch({ type: "unmount", id })
  }, [])

  const requestDialog = React.useCallback<RequestDialog>((kind, depth, request) => {
    const isRenderingOnServer = typeof document === "undefined"
    if (isRenderingOnServer) {
      throw new Error(NO_DOCUMENT_ERROR)
    }
    let resolve!: (result: unknown) => void
    const result = new Promise<unknown>((resolveResult) => {
      resolve = resolveResult
    })
    const entry: DialogEntry = { id: nextIdRef.current++, kind, depth, request, resolve }
    unsettledRef.current.add(entry)
    dispatch({ type: "request", entry })
    return result
  }, [])

  // Cached per depth: `useDialog` must hand back the same object on every render for callers that
  // list it as a dependency.
  const apiForDepth = React.useCallback(
    (depth: number): DialogApi => {
      const cached = apisByDepthRef.current.get(depth)
      if (cached !== undefined) {
        return cached
      }
      const api = createDialogApi(depth, requestDialog)
      apisByDepthRef.current.set(depth, api)
      return api
    },
    [requestDialog],
  )

  const successorFollows = hasSuccessor(queue)

  return (
    <DialogApiContext.Provider value={apiForDepth}>
      {children}
      {queue.mounted.map((entry) => (
        <QueuedDialog
          key={entry.id}
          entry={entry}
          isOpen={isDialogOpen(queue, entry.id)}
          hasSuccessor={successorFollows}
          onSettle={settle}
          onExitComplete={handleExitComplete}
        />
      ))}
    </DialogApiContext.Provider>
  )
}

/**
 * The promise-based `alert` / `confirm` / `prompt` for this part of the tree.
 *
 * The returned object and its three functions are referentially stable, so they are safe in a
 * dependency list. Throws if there is no `DialogProvider` above.
 */
export function useDialog(): DialogApi {
  const apiForDepth = React.useContext(DialogApiContext)
  const depth = React.useContext(DialogDepthContext)
  if (apiForDepth === null) {
    throw new Error(NO_DIALOG_PROVIDER_ERROR)
  }
  return apiForDepth(depth)
}

function createDialogApi(depth: number, requestDialog: RequestDialog): DialogApi {
  const prompt = (request: TextPromptRequest | CustomPromptRequest<unknown>) =>
    requestDialog(PROMPT_KIND, depth, request) as Promise<PromptResult<unknown>>
  return {
    alert: (request: AlertRequest | string) =>
      requestDialog(ALERT_KIND, depth, normalizeRequest(request)) as Promise<void>,
    confirm: (request: ConfirmRequest | string) =>
      requestDialog(CONFIRM_KIND, depth, normalizeRequest(request)) as Promise<boolean>,
    prompt: prompt as DialogApi["prompt"],
  }
}
