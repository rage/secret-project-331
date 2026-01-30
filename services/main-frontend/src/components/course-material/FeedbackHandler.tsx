"use client"

import { css } from "@emotion/css"
import { useAtom } from "jotai"
import React, { useCallback, useEffect, useRef } from "react"
import { useButton } from "react-aria"
import { useTranslation } from "react-i18next"

import EditProposalDialog from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import FeedbackTypeDialog from "./FeedbackTypeDialog"
import SelectionListener, { FEEDBACK_DIALOG_CONTENT_ID } from "./SelectionListener"

import Button from "@/shared-module/common/components/Button"
import {
  currentlyOpenFeedbackDialogAtom,
  selectionAtom,
} from "@/stores/course-material/materialFeedbackStore"
import { getModifierKey } from "@/utils/course-material/platformDetection"

interface Props {
  courseId: string
  pageId: string
}

const FeedbackHandler: React.FC<React.PropsWithChildren<Props>> = ({ courseId, pageId }) => {
  const { t } = useTranslation()
  const [type, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [selection] = useAtom(selectionAtom)
  const feedbackButtonRef = useRef<HTMLButtonElement>(null)

  const handleGiveFeedbackClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

  const focusDialog = useCallback(() => {
    if (type === "proposed-edits") {
      const dialogElement = document.getElementById(FEEDBACK_DIALOG_CONTENT_ID)
      if (dialogElement) {
        dialogElement.focus()
      }
    }
  }, [type])

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

  const { buttonProps } = useButton(
    {
      onPress: handleGiveFeedbackClick,
      "aria-label": t("give-feedback"),
    },
    feedbackButtonRef,
  )

  const showFeedbackButton = type === null && !selection.text

  return (
    <>
      {showFeedbackButton && (
        <div
          data-testid="give-feedback-button"
          className={css`
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 1100;
          `}
        >
          <Button ref={feedbackButtonRef} variant="primary" size="medium" {...buttonProps}>
            {t("give-feedback")}
          </Button>
        </div>
      )}

      {type === "select-type" && <FeedbackTypeDialog />}
      {type === "written" && <FeedbackDialog courseId={courseId} pageId={pageId} />}
      {type === "proposed-edits" && <EditProposalDialog courseId={courseId} pageId={pageId} />}
      {type === null && selection.text && <FeedbackTooltip />}
      <SelectionListener />
    </>
  )
}

export default FeedbackHandler
