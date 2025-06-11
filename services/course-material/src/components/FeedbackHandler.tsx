import { css } from "@emotion/css"
import { useAtom } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import { currentlyOpenFeedbackDialogAtom, selectionAtom } from "../stores/materialFeedbackStore"

import EditProposalDialog from "./EditProposalDialog"
import FeedbackDialog from "./FeedbackDialog"
import FeedbackTooltip from "./FeedbackTooltip"
import FeedbackTypeDialog from "./FeedbackTypeDialog"
import SelectionListener from "./SelectionListener"

import Button from "@/shared-module/common/components/Button"

interface Props {
  courseId: string
  pageId: string
}

const FeedbackHandler: React.FC<React.PropsWithChildren<Props>> = ({ courseId, pageId }) => {
  const { t } = useTranslation()
  const [type, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [selection] = useAtom(selectionAtom)

  const handleGiveFeedbackClick = () => {
    // eslint-disable-next-line i18next/no-literal-string
    setCurrentlyOpenFeedbackDialog("select-type")
  }

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
          <Button variant="primary" size="medium" onClick={handleGiveFeedbackClick}>
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
