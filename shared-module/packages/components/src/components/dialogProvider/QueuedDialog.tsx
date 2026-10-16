"use client"

import { css } from "@emotion/css"
import type { TFunction } from "i18next"
import React from "react"
import { FocusScope } from "react-aria"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "../../lib/utils/nullability"
import { Dialog, type DialogAction, type DialogExit, type DialogLabelling } from "../Dialog"
import { DialogDepthContext } from "./dialogContext"
import type {
  AlertRequest,
  ConfirmRequest,
  CustomPromptRequest,
  DialogEntry,
  DialogKind,
  PromptControls,
  TextPromptRequest,
} from "./dialogRequests"
import { dismissedResult } from "./dialogRequests"
import { PromptTextField } from "./PromptTextField"
import {
  ALERT_DIALOG_OK_BUTTON_TEST_ID,
  CONFIRM_DIALOG_NO_BUTTON_TEST_ID,
  CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
  DIALOG_PROVIDER_DIALOG_TEST_ID,
  PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID,
  PROMPT_DIALOG_OK_BUTTON_TEST_ID,
} from "./testIds"

export interface QueuedDialogProps {
  entry: DialogEntry
  isOpen: boolean
  /** Another dialog takes over when this one closes, so its scrim must not fade over the new one. */
  hasSuccessor: boolean
  onSettle: (entry: DialogEntry, result: unknown) => void
  onExitComplete: (id: number) => void
}

/** Set once the body has produced a value. The wrapper keeps `undefined` representable. */
interface PromptValue {
  value: unknown
}

/** Calls a caller-supplied custom body during its own render, so a throw is catchable below. */
const CustomBody: React.FC<{
  body: (controls: PromptControls<unknown>) => React.ReactNode
  controls: PromptControls<unknown>
}> = ({ body, controls }) => <>{body(controls)}</>

interface DialogBodyBoundaryProps {
  /** Runs once, from `componentDidCatch`, so the caller can settle the entry as dismissed. */
  onCrash: () => void
  children: React.ReactNode
}

/**
 * Contains a crash from a caller-supplied custom body to this one dialog, instead of letting it
 * propagate to whatever boundary the host app placed above `DialogProvider` — which would
 * otherwise unmount every other in-flight dialog along with the one at fault.
 */
class DialogBodyBoundary extends React.Component<DialogBodyBoundaryProps, { hasCrashed: boolean }> {
  public override state = { hasCrashed: false }

  public static getDerivedStateFromError(): { hasCrashed: boolean } {
    return { hasCrashed: true }
  }

  public override componentDidCatch(): void {
    this.props.onCrash()
  }

  public override render(): React.ReactNode {
    return this.state.hasCrashed ? null : this.props.children
  }
}

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
`

const messageCss = css`
  margin: 0;
`

const descriptionCss = css`
  margin: 0;
  color: var(--color-gray-600);
`

const EXIT_HANDOFF = "handoff"
const EXIT_FADE = "fade"

type SharedModuleTFunction = TFunction<"shared-module", undefined>

// A switch, not a `Record<DialogKind, string>` lookup: i18next's typed keys reject a plain
// `string` produced by indexing a record, so each branch has to call `t` with a literal.
function fallbackDialogLabel(kind: DialogKind, t: SharedModuleTFunction): string {
  switch (kind) {
    case "alert":
      return t("dialog.alertLabel")
    case "confirm":
      return t("dialog.confirmLabel")
    case "prompt":
      return t("dialog.promptLabel")
  }
}

/**
 * One entry of the dialog queue, rendered as a `Dialog`.
 *
 * Owns the prompt's in-progress value, because the submit action lives in the dialog footer and so
 * cannot read state held by the body.
 */
export const QueuedDialog: React.FC<QueuedDialogProps> = ({
  entry,
  isOpen,
  hasSuccessor,
  onSettle,
  onExitComplete,
}) => {
  const { t } = useTranslation("shared-module")
  const [promptValue, setPromptValue] = React.useState<PromptValue | null>(() =>
    initialPromptValue(entry),
  )
  const [validationError, setValidationError] = React.useState<string | null>(null)

  // A caller doing `await confirm(); alert()` only requests the next dialog once this one has
  // resolved and started closing, in the microtask right after `resolve()`. Deferring the visual
  // close by one microtask lets that request land, and `hasSuccessor` update, before Dialog's
  // AnimatePresence freezes `exit` at the render where `open` flips to false — without this, the
  // scrim always fades as if nothing were taking over, even when something is a tick away.
  const hasSuccessorRef = React.useRef(hasSuccessor)
  hasSuccessorRef.current = hasSuccessor
  const [visuallyOpen, setVisuallyOpen] = React.useState(isOpen)
  const frozenExitRef = React.useRef<DialogExit>(EXIT_FADE)

  React.useEffect(() => {
    if (isOpen) {
      setVisuallyOpen(true)
      return
    }
    queueMicrotask(() => {
      frozenExitRef.current = hasSuccessorRef.current ? EXIT_HANDOFF : EXIT_FADE
      setVisuallyOpen(false)
    })
  }, [isOpen])

  const settle = React.useCallback(
    (result: unknown) => {
      onSettle(entry, result)
    },
    [entry, onSettle],
  )

  const controls = React.useMemo<PromptControls<unknown>>(
    () => ({
      setValue: (value) => {
        setPromptValue({ value })
        setValidationError(null)
      },
      submit: (value) => {
        settle({ isSubmitted: true, value })
      },
      dismiss: () => {
        settle({ isSubmitted: false })
      },
    }),
    [settle],
  )

  const { request, kind } = entry
  const { message, title, description } = request

  const submitPrompt = () => {
    if (promptValue === null) {
      return
    }
    const validate = (request as TextPromptRequest).validate
    if (validate !== undefined && typeof promptValue.value === "string") {
      const error = validate(promptValue.value)
      if (error !== undefined) {
        setValidationError(error)
        return
      }
    }
    settle({ isSubmitted: true, value: promptValue.value })
  }

  const header = (
    <>
      {typeof message === "string" ? <p className={messageCss}>{message}</p> : message}
      {description !== undefined && <p className={descriptionCss}>{description}</p>}
    </>
  )

  const customBody = (request as CustomPromptRequest<unknown>).body
  const promptField =
    customBody !== undefined ? (
      <DialogBodyBoundary onCrash={() => settle(dismissedResult(kind))}>
        <CustomBody body={customBody} controls={controls} />
      </DialogBodyBoundary>
    ) : (
      <PromptTextField
        label={typeof message === "string" ? message : t("dialog.promptLabel")}
        value={typeof promptValue?.value === "string" ? promptValue.value : ""}
        errorMessage={validationError}
        onChange={controls.setValue}
        onSubmit={submitPrompt}
      />
    )

  const content =
    kind === "prompt" ? (
      // Gives the field the focus that would otherwise land on the dialog container; react-aria's
      // own `useDialog` steps aside once the body has claimed it.
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- react-aria's focus scope, not DOM autofocus
      <FocusScope autoFocus>
        <div className={bodyCss}>
          {header}
          {promptField}
        </div>
      </FocusScope>
    ) : (
      <div className={bodyCss}>{header}</div>
    )

  const labelling: DialogLabelling =
    title !== undefined
      ? { title }
      : { "aria-label": typeof message === "string" ? message : fallbackDialogLabel(kind, t) }

  const actions = buildActions({
    kind,
    request,
    t,
    settle,
    submitPrompt,
    isSubmitArmed: promptValue !== null,
  })

  return (
    <Dialog
      {...labelling}
      {...omitUndefined({ size: request.size, lang: request.lang })}
      open={visuallyOpen}
      onClose={() => {
        settle(dismissedResult(kind))
      }}
      onExitComplete={() => {
        onExitComplete(entry.id)
      }}
      // A short string message is an interruption that has to be read and answered, and
      // `alertdialog` is what makes a screen reader announce it on open. A node body is a surface to
      // work through, which some assistive technology would otherwise read out whole.
      role={kind !== "prompt" && typeof message === "string" ? "alertdialog" : "dialog"}
      // Without a title or a separate description, the content is just the message again — the
      // same text as the `aria-label` fallback below, so a description would only repeat the name.
      hasDescription={title !== undefined || description !== undefined}
      showCloseButton={false}
      isDismissable={false}
      exit={visuallyOpen ? (hasSuccessor ? EXIT_HANDOFF : EXIT_FADE) : frozenExitRef.current}
      data-testid={DIALOG_PROVIDER_DIALOG_TEST_ID}
      actions={actions}
    >
      <DialogDepthContext.Provider value={entry.depth + 1}>{content}</DialogDepthContext.Provider>
    </Dialog>
  )
}

interface ActionsInput {
  kind: DialogKind
  request: DialogEntry["request"]
  t: SharedModuleTFunction
  settle: (result: unknown) => void
  submitPrompt: () => void
  isSubmitArmed: boolean
}

function buildActions({
  kind,
  request,
  t,
  settle,
  submitPrompt,
  isSubmitArmed,
}: ActionsInput): readonly [DialogAction, ...DialogAction[]] {
  switch (kind) {
    case "alert": {
      const alertRequest = request as AlertRequest
      return [
        {
          label: alertRequest.acknowledgeLabel ?? t("dialog.ok"),
          "data-testid": ALERT_DIALOG_OK_BUTTON_TEST_ID,
          onPress: () => {
            settle(undefined)
          },
        },
      ]
    }
    case "confirm": {
      const confirmRequest = request as ConfirmRequest
      return [
        {
          label: confirmRequest.cancelLabel ?? t("dialog.decline"),
          variant: "secondary",
          "data-testid": CONFIRM_DIALOG_NO_BUTTON_TEST_ID,
          onPress: () => {
            settle(false)
          },
        },
        {
          label: confirmRequest.confirmLabel ?? t("dialog.confirm"),
          variant: confirmRequest.isDestructive === true ? "danger" : "primary",
          "data-testid": CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
          onPress: () => {
            settle(true)
          },
        },
      ]
    }
    case "prompt": {
      const promptRequest = request as TextPromptRequest
      return [
        {
          label: promptRequest.cancelLabel ?? t("dialog.cancel"),
          variant: "secondary",
          "data-testid": PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID,
          onPress: () => {
            settle({ isSubmitted: false })
          },
        },
        {
          label: promptRequest.submitLabel ?? t("dialog.ok"),
          disabled: !isSubmitArmed,
          "data-testid": PROMPT_DIALOG_OK_BUTTON_TEST_ID,
          onPress: submitPrompt,
        },
      ]
    }
  }
}

function initialPromptValue(entry: DialogEntry): PromptValue | null {
  if (entry.kind !== "prompt") {
    return null
  }
  const defaultValue = (entry.request as TextPromptRequest).defaultValue
  return defaultValue === undefined ? null : { value: defaultValue }
}
