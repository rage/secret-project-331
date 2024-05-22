import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import EditProposalDialog from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import SelectionListener from "./SelectionListener"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"

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
  const [feedbackMenuAnchor, setFeedbackMenuAnchor] = useState<Element | null>(null)
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

  function openFeedbackDialog() {
    setSelectionRect(null)
    setFeedbackDialogOpen(true)
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
          {feedbackMenuAnchor !== null && (
            <div
              className={css`
                display: flex;
                flex-direction: column;
                background: white;
                box-shadow: rgba(0, 0, 0, 0.35) 0px 5px 15px;
                padding: 10px;
                position: fixed;
                bottom: 20px;
                right: 25px;
                z-index: 1110;
              `}
            >
              <Button
                onClick={() => {
                  setFeedbackMenuAnchor(null)
                  setFeedbackDialogOpen(true)
                  setLastSelection("")
                }}
                variant={"icon"}
                transform="capitalize"
                size={"small"}
              >
                {t("written-feedback")}
              </Button>
              <Button
                onClick={() => {
                  setFeedbackMenuAnchor(null)
                  setEditProposalDialogOpen(true)
                  onEnterEditProposalMode()
                }}
                variant={"icon"}
                transform="capitalize"
                size={"small"}
              >
                {t("improve-material")}
              </Button>
            </div>
          )}

          <Button
            className="give-feedback-button"
            variant={"primary"}
            size={"medium"}
            onClick={(ev) => {
              if (feedbackMenuAnchor !== null) {
                setFeedbackMenuAnchor(null)
              } else {
                setFeedbackMenuAnchor(ev.currentTarget)
              }
            }}
          >
            {t("give-feedback")}
          </Button>
        </div>
      )}
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
        <FeedbackTooltip selectionRect={selectionRect} onClick={openFeedbackDialog} />
      )}
      <SelectionListener
        onSelectionChange={handleSelectionChange}
        updateSelectionPosition={updateSelectionRect}
      />
    </>
  )
}

export default FeedbackHandler
