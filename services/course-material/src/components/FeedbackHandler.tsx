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

  return (
    <>
      <div
        className={css`
          position: fixed;
          bottom: 10px;
          right: 10px;
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
      />
      <SelectionListener onSelectionChange={handleSelectionChange} />
    </>
  )
}

export default FeedbackHandler
