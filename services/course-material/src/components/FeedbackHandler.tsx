import { css } from "@emotion/css"
import { Menu, MenuItem } from "@material-ui/core"
import React, { useState } from "react"

import { NewProposedBlockEdit } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

import EditProposalDialog from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import SelectionListener from "./SelectionListener"

interface Props {
  courseId: string
  pageId: string
  onEnterEditProposalMode: () => void
  onExitEditProposalMode: () => void
  selectedBlockId: string | null
  setSelectedBlockId: (blockId: string | null) => void
  edits: Map<string, NewProposedBlockEdit>
}

const FeedbackHandler: React.FC<Props> = ({
  courseId,
  pageId,
  onEnterEditProposalMode,
  onExitEditProposalMode,
  selectedBlockId,
  setSelectedBlockId,
  edits,
}) => {
  const [feedbackMenuAnchor, setFeedbackMenuAnchor] = useState<Element | null>(null)
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false)
  const [editProposalDialogOpen, setEditProposalDialogOpen] = useState(false)
  const [lastSelection, setLastSelection] = useState("")
  const [showFeedbackTooltipTimeout, setShowFeedbackTooltipTimeout] =
    useState<NodeJS.Timeout | null>(null)
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null)
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false)

  async function handleSelectionChange(newSelection: string, rect: DOMRect | null) {
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

  function openFeedbackDialog() {
    setSelectionRect(null)
    setFeedbackDialogOpen(true)
  }

  function onSubmitSuccess() {
    setShowSubmitSuccess(true)
    setTimeout(() => {
      setShowSubmitSuccess(false)
    }, 5000)
  }

  return (
    <>
      {showSubmitSuccess && (
        <div
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
      )}
      {!feedbackDialogOpen && !editProposalDialogOpen && (
        <div
          className={css`
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 100;
          `}
        >
          <Menu
            open={feedbackMenuAnchor !== null}
            anchorEl={feedbackMenuAnchor}
            onClose={() => setFeedbackMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => {
                setFeedbackMenuAnchor(null)
                setFeedbackDialogOpen(true)
                setLastSelection("")
              }}
            >
              Written feedback
            </MenuItem>
            <MenuItem
              onClick={() => {
                setFeedbackMenuAnchor(null)
                setEditProposalDialogOpen(true)
                onEnterEditProposalMode()
              }}
            >
              Improve material
            </MenuItem>
          </Menu>
          <Button
            variant={"primary"}
            size={"medium"}
            onClick={(ev) => setFeedbackMenuAnchor(ev.currentTarget)}
          >
            Give feedback
          </Button>
        </div>
      )}
      {feedbackDialogOpen && (
        <FeedbackDialog
          courseId={courseId}
          close={() => setFeedbackDialogOpen(false)}
          lastSelection={lastSelection}
          setLastSelection={setLastSelection}
          onSubmitSuccess={onSubmitSuccess}
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
          onSubmitSuccess={onSubmitSuccess}
          selectedBlockId={selectedBlockId}
          setSelectedBlockId={setSelectedBlockId}
          edits={edits}
        />
      )}

      {!feedbackDialogOpen && !editProposalDialogOpen && (
        <FeedbackTooltip selectionRect={selectionRect} onClick={openFeedbackDialog} />
      )}
      <SelectionListener onSelectionChange={handleSelectionChange} />
    </>
  )
}

export default FeedbackHandler
