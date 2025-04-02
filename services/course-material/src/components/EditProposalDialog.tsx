import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { postProposedEdits } from "../services/backend"

import { NewProposedBlockEdit } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  courseId: string
  pageId: string
  close: () => unknown
  selectedBlockId: string | null
  clearSelectedBlockId: () => void
  edits: Map<string, NewProposedBlockEdit>
}

const CLOSE_ICON = "×"

const EditProposalDialog: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pageId,
  close,
  selectedBlockId,
  clearSelectedBlockId,
  edits,
}) => {
  const { t } = useTranslation()
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
        close()
      },
    },
  )

  let topMessage
  let bottomMessage
  let leftButton
  if (selectedBlockId !== null) {
    // currently editing block
    topMessage = t("youve-selected-material-for-editing")
    bottomMessage = t("preview-changes-or-make-more-edits")
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
  } else if (edits.size === 0) {
    // not editing a block and no existing edits
    topMessage = t("click-on-course-material-to-make-it-editable")
    bottomMessage = t("click-on-any-paragraph-to-edit")
    leftButton = null
  } else {
    // not editing and have existing edits
    topMessage = t("youve-made-changes")
    bottomMessage = t("do-you-want-to-send-changes")
    leftButton = (
      <Button
        variant="primary"
        size="medium"
        onClick={() => mutation.mutate(Array.from(edits.values()))}
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
          onClick={close}
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
