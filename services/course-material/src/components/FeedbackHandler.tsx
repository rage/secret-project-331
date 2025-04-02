import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import EditProposalDialog from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import FeedbackTypeDialog from "./FeedbackTypeDialog"
import SelectionListener from "./SelectionListener"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"

interface Props {
  courseId: string
  pageId: string
  onEnterEditProposalMode: () => void
  onExitEditProposalMode: () => void
  selectedBlockId: string | null
  clearSelectedBlockId: () => void
  edits: Map<string, NewProposedBlockEdit>
}

export interface SelectionPosition {
  x: number
  y: number
}

const FeedbackHandler: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pageId,
  onEnterEditProposalMode,
  onExitEditProposalMode,
  selectedBlockId,
  clearSelectedBlockId,
  edits,
}) => {
  const { t } = useTranslation()
  const [feedbackTypeDialogOpen, setFeedbackTypeDialogOpen] = useState(false)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [editProposalDialogOpen, setEditProposalDialogOpen] = useState(false)
  const [lastSelection, setLastSelection] = useState("")
  const [showFeedbackTooltipTimeout, setShowFeedbackTooltipTimeout] =
    useState<NodeJS.Timeout | null>(null)
  const [selectionRect, setSelectionRect] = useState<SelectionPosition | null>(null)

  function handleSelectionChange(newSelection: string, rect: DOMRect | null) {
    if (showFeedbackTooltipTimeout !== null) {
      clearTimeout(showFeedbackTooltipTimeout)
    }
    if (newSelection.length > 0) {
      setLastSelection(newSelection)
    }

    const timeout = setTimeout(() => {
      if (newSelection.length > 0) {
        setSelectionRect(rect)
      } else {
        setSelectionRect(null)
      }
    }, 200)
    setShowFeedbackTooltipTimeout(timeout)
  }

  function updateSelectionRect(pos: { x: number; y: number }) {
    if (selectionRect !== null) {
      setSelectionRect({ x: pos.x, y: pos.y })
    }
  }

  return (
    <>
      {!feedbackDialogOpen && !editProposalDialogOpen && (
        <div
          id="give-feedback-button"
          className={css`
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 1100;
          `}
        >
          <Button
            className="give-feedback-button"
            variant={"primary"}
            size={"medium"}
            onClick={() => setFeedbackTypeDialogOpen(true)}
          >
            {t("give-feedback")}
          </Button>
        </div>
      )}

      <FeedbackTypeDialog
        open={feedbackTypeDialogOpen}
        onClose={() => setFeedbackTypeDialogOpen(false)}
        onSelectFeedback={() => {
          setFeedbackDialogOpen(true)
          setLastSelection("")
        }}
        onSelectImprovement={() => {
          setEditProposalDialogOpen(true)
          onEnterEditProposalMode()
        }}
      />

      {feedbackDialogOpen && (
        <FeedbackDialog
          courseId={courseId}
          close={() => setFeedbackDialogOpen(false)}
          lastSelection={lastSelection}
          setLastSelection={setLastSelection}
          pageId={pageId}
        />
      )}
      {editProposalDialogOpen && (
        <EditProposalDialog
          courseId={courseId}
          pageId={pageId}
          close={() => {
            setEditProposalDialogOpen(false)
            onExitEditProposalMode()
          }}
          selectedBlockId={selectedBlockId}
          clearSelectedBlockId={clearSelectedBlockId}
          edits={edits}
        />
      )}

      {!feedbackDialogOpen && !editProposalDialogOpen && selectionRect && (
        <FeedbackTooltip
          selectionRect={selectionRect}
          onClick={() => setFeedbackTypeDialogOpen(true)}
        />
      )}
      <SelectionListener
        onSelectionChange={handleSelectionChange}
        updateSelectionPosition={updateSelectionRect}
      />
    </>
  )
}

export default FeedbackHandler
