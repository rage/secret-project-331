import { css } from "@emotion/css"
import React, { useState } from "react"

import Button from "../shared-module/components/Button"

import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import SelectionListener from "./SelectionListener"

interface Props {
  courseSlug: string
}

const FeedbackHandler: React.FC<Props> = ({ courseSlug }) => {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [previousSelection, setPreviousSelection] = useState("")
  const [currentSelection, setCurrentSelection] = useState("")
  const [feedbackSelection, setFeedbackSelection] = useState("")
  const [showFeedbackTooltipTimeout, setShowFeedbackTooltipTimeout] =
    useState<NodeJS.Timeout | null>(null)
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)

  async function handleSelectionChange(newSelection: string, rect: DOMRect | null) {
    if (showFeedbackTooltipTimeout !== null) {
      clearTimeout(showFeedbackTooltipTimeout)
    }
    setPreviousSelection(currentSelection)
    setCurrentSelection(newSelection)

    const timeout = setTimeout(() => {
      if (newSelection.length > 0) {
        setSelectionRect(rect)
      } else {
        setSelectionRect(null)
      }
    }, 200)
    setShowFeedbackTooltipTimeout(timeout)
  }

  function openFeedbackDialog(feedbackSelection: string) {
    setSelectionRect(null)
    setFeedbackSelection(feedbackSelection)
    setFeedbackDialogOpen(true)
  }

  function closeFeedbackDialog() {
    setFeedbackDialogOpen(false)
  }

  function onSubmitSuccess() {
    setShowSubmitSuccess(true)
    setTimeout(() => {
      setShowSubmitSuccess(false)
    }, 5000)
  }

  return (
    <>
      <div
        hidden={!showSubmitSuccess}
        className={css`
          position: fixed;
          text-align: center;
          width: 120px;
          height: 80px;
          bottom: 10px;
          right: 200px;
          background-color: LightGreen;
          z-index: 100;
        `}
      >
        Feedback submitted successfully
      </div>
      <div
        className={css`
          position: fixed;
          bottom: 10px;
          right: 10px;
          z-index: 100;
        `}
      >
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => openFeedbackDialog(currentSelection)}
        >
          Give feedback
        </Button>
      </div>

      <FeedbackTooltip
        selectionRect={selectionRect}
        onClick={() => openFeedbackDialog(previousSelection)}
      />
      <FeedbackDialog
        courseSlug={courseSlug}
        open={feedbackDialogOpen}
        close={closeFeedbackDialog}
        selection={feedbackSelection}
        onSubmitSuccess={onSubmitSuccess}
      />
      <SelectionListener onSelectionChange={handleSelectionChange} />
    </>
  )
}

export default FeedbackHandler
