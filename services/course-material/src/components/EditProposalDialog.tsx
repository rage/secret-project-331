import { css } from "@emotion/css"
import { useAtom } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import { postProposedEdits } from "../services/backend"
import {
  blockEditsAtom,
  currentlyOpenFeedbackDialogAtom,
  selectedBlockIdAtom,
} from "../stores/materialFeedbackStore"

import { FEEDBACK_DIALOG_CONTENT_ID } from "./SelectionListener"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  courseId: string
  pageId: string
}

const CLOSE_ICON = "×"

const EditProposalDialog: React.FC<React.PropsWithChildren<Props>> = ({ courseId, pageId }) => {
  const { t } = useTranslation()
  const [type, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)
  const [blockEdits] = useAtom(blockEditsAtom)
  const [selectedBlockId, setSelectedBlockId] = useAtom(selectedBlockIdAtom)

  const mutation = useToastMutation(
    (block_edits: NewProposedBlockEdit[]) => {
      return postProposedEdits(courseId, { page_id: pageId, block_edits })
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("feedback-submitted-successfully"),
    },
    {
      onSuccess: () => {
        setCurrentlyOpenFeedbackDialog(null)
      },
    },
  )

  if (type !== "proposed-edits") {
    return null
  }

  const handleClose = () => {
    setCurrentlyOpenFeedbackDialog(null)
  }

  const clearSelectedBlockId = () => {
    setSelectedBlockId(null)
  }

  let topMessage
  let bottomMessage
  let leftButton
  if (selectedBlockId !== null) {
    // currently editing block
    topMessage = t("type-your-changes-directly-to-into-the-content")
    bottomMessage = t("click-on-any-paragraph-to-edit")
    leftButton = (
      <Button
        variant="primary"
        size="medium"
        onClick={clearSelectedBlockId}
        className={css`
          min-width: 100px;
          width: 100%;

          ${respondToOrLarger.xxs} {
            width: auto;
          }
        `}
      >
        {t("preview")}
      </Button>
    )
  } else if (blockEdits.size === 0) {
    // not editing a block and no existing edits
    topMessage = t("click-on-paragraph-to-make-it-editable")
    bottomMessage = t("click-on-any-paragraph-to-edit")
    leftButton = null
  } else {
    // not editing and have existing edits
    topMessage = t("send-your-proposal-to-review-or-select-another-paragraph")
    bottomMessage = t("do-you-want-to-send-changes")
    leftButton = (
      <Button
        variant="primary"
        size="medium"
        onClick={() => mutation.mutate(Array.from(blockEdits.values()))}
        className={css`
          min-width: 100px;
          width: 100%;

          ${respondToOrLarger.xxs} {
            width: auto;
          }
        `}
      >
        {t("send")}
      </Button>
    )
  }

  return (
    <div
      className={css`
        position: fixed;
        max-width: 500px;
        width: calc(100% - 40px);
        background: ${baseTheme.colors.primary[100]};
        border: 2px solid ${baseTheme.colors.gray[200]};
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        bottom: 20px;
        right: 20px;
        left: 20px;
        z-index: 1100;
        display: flex;
        flex-direction: column;
        max-height: 80vh;
        height: auto;
        min-height: 200px;
        overflow-y: auto;

        ${respondToOrLarger.xxs} {
          width: 400px;
          left: auto;
          height: auto;
          max-height: 60vh;
        }
      `}
      id={FEEDBACK_DIALOG_CONTENT_ID}
    >
      <div
        className={css`
          padding: 1rem 1.5rem;
          position: sticky;
          top: 0;
          background: ${baseTheme.colors.primary[100]};
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid ${baseTheme.colors.gray[100]};
          z-index: 1;
        `}
      >
        <h2
          className={css`
            font-family: ${primaryFont};
            font-size: 1.25rem;
            font-weight: 600;
            color: ${baseTheme.colors.gray[700]};
            margin: 0;
          `}
        >
          {topMessage}
        </h2>
        <button
          onClick={handleClose}
          className={css`
            background: none;
            border: none;
            padding: 0.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition:
              background-color 0.2s ease,
              box-shadow 0.2s ease;
            font-size: 24px;
            line-height: 1;
            width: 40px;
            height: 40px;
            margin-right: -0.5rem;
            color: ${baseTheme.colors.gray[600]};

            &:hover {
              background-color: ${baseTheme.colors.gray[100]};
            }

            &:focus {
              outline: none;
              box-shadow:
                0 0 0 2px ${baseTheme.colors.primary[100]},
                0 0 0 4px ${baseTheme.colors.gray[200]};
            }
          `}
          aria-label={t("close")}
        >
          {CLOSE_ICON}
        </button>
      </div>

      <div
        className={css`
          padding: 1rem;
          border-radius: 0 0 8px 8px;

          ${respondToOrLarger.xxs} {
            padding: 1.5rem;
          }
        `}
      >
        {mutation.isError && (
          <div
            className={css`
              color: ${baseTheme.colors.red[600]};
              margin-bottom: 1rem;
              font-size: 0.875rem;
            `}
          >
            {t("failed-to-submit", { error: mutation.error })}
          </div>
        )}

        {bottomMessage && (
          <div
            className={css`
              color: ${baseTheme.colors.gray[600]};
              margin-bottom: 1rem;
              font-size: 0.875rem;
              line-height: 1.5;
            `}
          >
            {bottomMessage}
          </div>
        )}

        {leftButton && (
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
              margin-top: 0.5rem;

              ${respondToOrLarger.xxs} {
                flex-direction: row;
                justify-content: flex-end;
              }
            `}
          >
            {leftButton}
          </div>
        )}
      </div>
    </div>
  )
}

export default EditProposalDialog
