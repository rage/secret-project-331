"use client"

import { css, cx } from "@emotion/css"
import { useAtom } from "jotai"
import React, { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { omitUndefined } from "@/shared-module/common/utils/nullability"
import { Button } from "@/shared-module/components"
import {
  currentlyOpenFeedbackDialogAtom,
  selectionAtom,
} from "@/stores/course-material/materialFeedbackStore"
import { getModifierKey } from "@/utils/course-material/platformDetection"

import EditProposalDialog, { FEEDBACK_BOTTOM_CLEARANCE_VAR } from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTypeDialog from "./FeedbackTypeDialog"
import SelectionListener, { FEEDBACK_DIALOG_CONTENT_ID } from "./SelectionListener"
import TextSelectionTooltip from "./TextSelectionTooltip"

const FEEDBACK_BUTTON_INSET = "10px"

const feedbackButtonHiddenCss = css`
  visibility: hidden;
`

const feedbackButtonCss = css`
  position: fixed;
  bottom: ${FEEDBACK_BUTTON_INSET};
  right: ${FEEDBACK_BUTTON_INSET};
  z-index: var(--layer-sticky);

  /* No transition: reduced motion's 0.01ms one delays unhiding, so focus returned to a still-hidden button. */
  transition: none;

  /* On very short viewports a fixed button can cover the focused control (WCAG 2.4.11). */
  @media (max-height: 400px) {
    position: absolute;
  }
`

// Lets the end of the page be scrolled clear of the fixed button. Goes on <body> because what
// sits under the button is the footer, not this component's subtree.
const feedbackButtonClearanceCss = css`
  padding-bottom: calc(var(--control-height-md) + ${FEEDBACK_BUTTON_INSET} * 2);
`

// Keeps focused elements scrolled clear of the button, or of the edit panel which sets the variable.
const feedbackScrollPaddingCss = css`
  scroll-padding-bottom: var(
    ${FEEDBACK_BOTTOM_CLEARANCE_VAR},
    calc(var(--control-height-md) + ${FEEDBACK_BUTTON_INSET} * 2)
  );
`

interface Props {
  courseId: string
  courseName?: string
  courseHasChatbot: boolean
  pageId: string
  pageTitle?: string
}

const FeedbackHandler: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pageId,
  courseName,
  courseHasChatbot,
  pageTitle,
}) => {
  const { t } = useTranslation()
  const [type, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [selection] = useAtom(selectionAtom)

  const handleGiveFeedbackClick = () => {
    // oxlint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

  const triggerRef = useRef<HTMLButtonElement>(null)
  const previousTypeRef = useRef(type)

  const focusDialog = useCallback(() => {
    if (type === "proposed-edits") {
      const dialogElement = document.querySelector<HTMLElement>(`#${FEEDBACK_DIALOG_CONTENT_ID}`)
      const target = dialogElement?.querySelector<HTMLElement>("h2") ?? dialogElement
      target?.focus()
    }
  }, [type])

  // The trigger stays mounted (hidden) while a dialog is open; focus goes back to it on close.
  useEffect(() => {
    const wasOpen = previousTypeRef.current !== null
    previousTypeRef.current = type
    if (wasOpen && type === null && !selection.text) {
      triggerRef.current?.focus()
    }
  }, [type, selection.text])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierKey = getModifierKey()
      const isModifierPressed = modifierKey === "Meta" ? e.metaKey : e.ctrlKey

      if (isModifierPressed && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault()
        focusDialog()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [focusDialog])

  // Held for the whole mount, not just while the button shows, so opening a dialog does not
  // reflow the page behind it.
  useEffect(() => {
    const { body } = document
    const html = document.documentElement
    body.classList.add(feedbackButtonClearanceCss)
    html.classList.add(feedbackScrollPaddingCss)
    return () => {
      body.classList.remove(feedbackButtonClearanceCss)
      html.classList.remove(feedbackScrollPaddingCss)
    }
  }, [])

  const showFeedbackButton = type === null && !selection.text

  return (
    <>
      <div
        data-testid="give-feedback-button"
        className={cx(feedbackButtonCss, !showFeedbackButton && feedbackButtonHiddenCss)}
      >
        <Button ref={triggerRef} variant="primary" size="medium" onPress={handleGiveFeedbackClick}>
          {t("give-feedback")}
        </Button>
      </div>

      {type === "select-type" && <FeedbackTypeDialog />}
      {type === "written" && <FeedbackDialog courseId={courseId} pageId={pageId} />}
      {type === "proposed-edits" && <EditProposalDialog courseId={courseId} pageId={pageId} />}
      {type === null && selection.text && (
        <TextSelectionTooltip
          {...omitUndefined({ courseName })}
          {...omitUndefined({ pageTitle })}
          courseHasChatbot={courseHasChatbot}
        />
      )}
      <SelectionListener />
    </>
  )
}

export default FeedbackHandler
