import { css } from "@emotion/css"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import React from "react"
import { useTranslation } from "react-i18next"

import { currentlyOpenFeedbackDialogAtom, selectionAtom } from "../stores/materialFeedbackStore"

import ImprovementExample from "./ImprovementExample"
import { FEEDBACK_DIALOG_CONTENT_ID } from "./SelectionListener"

import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"

const FeedbackTypeDialog: React.FC = () => {
  const { t } = useTranslation()
  const [type, setCurrentlyOpenFeedbackDialog] = useAtom(currentlyOpenFeedbackDialogAtom)

  const selection = useAtomValue(selectionAtom)
  const setSelection = useSetAtom(selectionAtom)

  // Click handlers we have in `SelectionListener` are aggressive with clearing the selction when this dialog is open. For performance, it's better to restore the selection after this dialog closes rather than checking on every update whether the
  const restoreSelectionIfNeeded = (fn: () => void) => {
    const savedSelection = selection
    const restoreSelection = () => {
      setSelection(savedSelection.text, savedSelection.position, savedSelection.element)
    }
    fn()
    if (savedSelection.text) {
      setTimeout(restoreSelection, 100)
      setTimeout(restoreSelection, 300)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, callback: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      callback()
    }
  }

  const handleFeedbackClick = () => {
    restoreSelectionIfNeeded(() => {
      // eslint-disable-next-line i18next/no-literal-string
      setCurrentlyOpenFeedbackDialog("written")
    })
  }

  const handleImprovementClick = () => {
    restoreSelectionIfNeeded(() => {
      // eslint-disable-next-line i18next/no-literal-string
      setCurrentlyOpenFeedbackDialog("proposed-edits")
    })
  }

  const handleClose = () => {
    setCurrentlyOpenFeedbackDialog(null)
  }

  return (
    <StandardDialog
      open={type === "select-type"}
      onClose={handleClose}
      title={t("select-feedback-type")}
      width="normal"
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1rem 0;
        `}
        id={FEEDBACK_DIALOG_CONTENT_ID}
      >
        <button
          onClick={handleFeedbackClick}
          onKeyDown={(e) => handleKeyDown(e, handleFeedbackClick)}
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1.5rem;
            border-radius: 8px;
            background-color: white;
            border: 2px solid ${baseTheme.colors.gray[200]};
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            width: 100%;
            text-align: left;

            &:hover {
              background-color: ${baseTheme.colors.gray[100]};
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            &:active {
              transform: translateY(0);
            }

            &:focus {
              outline: none;
              box-shadow: 0 0 0 2px ${baseTheme.colors.gray[200]};
            }

            &::after {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              width: 0;
              height: 0;
              border-style: solid;
              border-width: 0 40px 40px 0;
              border-color: transparent ${baseTheme.colors.gray[200]} transparent transparent;
            }
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            `}
          >
            <h3
              className={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("written-feedback")}
            </h3>
            <p
              className={css`
                font-size: 0.875rem;
                color: ${baseTheme.colors.gray[600]};
                margin: 0;
                line-height: 1.5;
              `}
            >
              {t("can-comment-on-portions-of-material-by-highlightig")}
            </p>
          </div>
        </button>

        <button
          onClick={handleImprovementClick}
          onKeyDown={(e) => handleKeyDown(e, handleImprovementClick)}
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1.5rem;
            border-radius: 8px;
            background-color: white;
            border: 2px solid ${baseTheme.colors.green[200]};
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
            width: 100%;
            text-align: left;

            &:hover {
              background-color: ${baseTheme.colors.green[100]};
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            &:active {
              transform: translateY(0);
            }

            &:focus {
              outline: none;
              box-shadow: 0 0 0 2px ${baseTheme.colors.green[200]};
            }

            &::after {
              content: "";
              position: absolute;
              top: 0;
              right: 0;
              width: 0;
              height: 0;
              border-style: solid;
              border-width: 0 40px 40px 0;
              border-color: transparent ${baseTheme.colors.green[200]} transparent transparent;
            }
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            `}
          >
            <h3
              className={css`
                font-size: 1.25rem;
                font-weight: 600;
                color: ${baseTheme.colors.gray[700]};
                margin: 0;
              `}
            >
              {t("improve-material")}
            </h3>
            <p
              className={css`
                font-size: 0.875rem;
                color: ${baseTheme.colors.gray[600]};
                margin: 0;
                line-height: 1.5;
              `}
            >
              {t("improve-material-description")}
            </p>
            <ImprovementExample />
          </div>
        </button>
      </div>
    </StandardDialog>
  )
}

export default FeedbackTypeDialog
