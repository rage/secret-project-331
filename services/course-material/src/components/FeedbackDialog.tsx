import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postFeedback } from "../services/backend"
import { useFeedbackStore } from "../stores/materialFeedbackStore"
import { courseMaterialBlockClass } from "../utils/constants"

import { FeedbackBlock } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, primaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

interface Props {
  courseId: string
  pageId: string
}

interface Comment {
  selectedText: string
  comment: string
  relatedBlocks: Array<FeedbackBlock>
}

const CLOSE_SYMBOL = "×"

const FeedbackDialog: React.FC<React.PropsWithChildren<Props>> = ({ courseId, pageId }) => {
  const { t } = useTranslation()
  const store = useFeedbackStore()
  const [comments, setComments] = useState<Array<Comment>>([])
  const [comment, setComment] = useState("")
  const [lastSelection, setLastSelection] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mutation = useToastMutation(
    (comments: Comment[]) => {
      const feedback = comments.map((c) => {
        return {
          feedback_given: c.comment,
          selected_text: c.selectedText.length > 0 ? c.selectedText : null,
          related_blocks: c.relatedBlocks,
          page_id: pageId,
        }
      })
      return postFeedback(courseId, feedback)
    },
    {
      notify: true,
      method: "POST",
      successMessage: t("feedback-submitted-successfully"),
    },
    {
      onSuccess: () => {
        store.setCurrentlyOpenFeedbackDialog(null)
      },
    },
  )

  if (store.type !== "written") {
    return null
  }

  const handleClose = () => {
    store.setCurrentlyOpenFeedbackDialog(null)
  }

  async function addComment() {
    setError("")
    if (comment.length === 0) {
      setError(t("error-comment-cannot-be-empty"))
      return
    }
    if (charactersLeft <= 0) {
      setError(t("error-comment-too-long"))
      return
    }

    const relatedBlocks: Array<FeedbackBlock> = []
    const blocks = document.getElementsByClassName(courseMaterialBlockClass)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const rect = block.getBoundingClientRect()
      const topBelowScreen = rect.top > window.innerHeight
      const bottomAboveScreen = rect.bottom < 0
      const onScreen = !bottomAboveScreen && !topBelowScreen
      if (onScreen) {
        const text = block.textContent ? block.textContent.slice(0, 1000) : null
        relatedBlocks.push({
          id: block.id,
          text,
          order_number: relatedBlocks.length,
        })
      }
    }
    const selectedText = lastSelection.slice(0, 10000)
    setComments((cs) => [...cs, { comment, selectedText, relatedBlocks }])
    setComment("")
    setLastSelection("")
  }

  const charactersLeft = 1000 - comment.length

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
        bottom: 100px;
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
          {t("written-feedback")}
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
          {CLOSE_SYMBOL}
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
        {comments.length > 0 ? (
          comments.map((c, i) => (
            <div
              key={`${c}-${i}`}
              className={css`
                background: ${baseTheme.colors.clear[100]};
                border: 1px solid ${baseTheme.colors.gray[200]};
                border-radius: 6px;
                padding: 1rem;
                margin-bottom: 1rem;
              `}
            >
              {c.selectedText.length > 0 && (
                <div
                  className={css`
                    background: ${baseTheme.colors.green[100]};
                    padding: 0.75rem;
                    border-radius: 4px;
                    margin-bottom: 0.75rem;
                    font-family: "Space Mono", monospace;
                    font-size: 0.875rem;
                    color: ${baseTheme.colors.green[700]};
                    overflow: hidden;
                    text-overflow: ellipsis;
                    border: 1px solid ${baseTheme.colors.green[200]};
                  `}
                >
                  {c.selectedText}
                </div>
              )}
              <div
                className={css`
                  color: ${baseTheme.colors.gray[600]};
                  margin-bottom: 0.75rem;
                `}
              >
                {c.comment}
              </div>
              <button
                className={css`
                  color: ${baseTheme.colors.gray[600]};
                  font-size: 0.875rem;
                  cursor: pointer;
                  padding: 0;
                  border: none;
                  background: none;
                  transition: color 0.2s ease;

                  &:hover {
                    color: ${baseTheme.colors.red[600]};
                  }
                `}
                onClick={() =>
                  setComments((cs) => [...cs.slice(0, i), ...cs.slice(i + 1, cs.length)])
                }
              >
                {t("delete")}
              </button>
            </div>
          ))
        ) : (
          <div
            className={css`
              color: ${baseTheme.colors.gray[500]};
              text-align: center;
              padding: 2rem 0;
            `}
          >
            {t("no-comments-yet")}
          </div>
        )}
      </div>

      <div
        className={css`
          padding: 1.5rem;
          border-top: 1px solid ${baseTheme.colors.gray[200]};
          background: ${baseTheme.colors.primary[100]};
        `}
      >
        {lastSelection.length > 0 ? (
          <div
            className={css`
              background: ${baseTheme.colors.green[100]};
              border: 1px solid ${baseTheme.colors.green[200]};
              border-radius: 6px;
              padding: 1rem;
              margin-bottom: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 0.5rem;
              `}
            >
              <div
                className={css`
                  color: ${baseTheme.colors.green[700]};
                  font-weight: 500;
                  font-size: 0.875rem;
                `}
              >
                {t("commenting-on-selection")}
              </div>
              <Button variant="tertiary" size="small" onClick={() => setLastSelection("")}>
                {t("clear")}
              </Button>
            </div>
            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
                font-size: 0.875rem;
                line-height: 1.5;
                background: ${baseTheme.colors.primary[100]};
                padding: 0.75rem;
                border-radius: 4px;
                border: 1px solid ${baseTheme.colors.gray[200]};
              `}
            >
              {lastSelection}
            </div>
          </div>
        ) : (
          <div
            className={css`
              background: ${baseTheme.colors.clear[100]};
              border: 1px solid ${baseTheme.colors.gray[200]};
              border-radius: 6px;
              padding: 1rem;
              margin-bottom: 1rem;
              display: flex;
              align-items: center;
              gap: 0.75rem;
            `}
          >
            <InfoCircle size={24} />

            <div
              className={css`
                color: ${baseTheme.colors.gray[600]};
                font-size: 0.875rem;
                line-height: 1.5;
              `}
            >
              {t("commenting-on-whole-page")}
              <span
                className={css`
                  color: ${baseTheme.colors.gray[500]};
                  font-size: 0.8125rem;
                  display: block;
                  margin-top: 0.25rem;
                `}
              >
                {t("select-text-to-comment-on-specific-portion")}
              </span>
            </div>
          </div>
        )}

        <TextAreaField
          value={comment}
          label={t("add-comment")}
          name=""
          onChangeByValue={(value) => setComment(value)}
          placeholder={t("write-your-feedback-here")}
          autoResize
          rows={3}
        />

        <div
          className={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 0.5rem;
            margin-bottom: 1rem;
          `}
        >
          {charactersLeft >= 0 && charactersLeft < 200 && (
            <span
              className={css`
                color: ${baseTheme.colors.gray[500]};
                font-size: 0.875rem;
              `}
            >
              {t("n-characters-left", { n: charactersLeft })}
            </span>
          )}
          {charactersLeft < 0 && (
            <span
              className={css`
                color: ${baseTheme.colors.red[600]};
                font-size: 0.875rem;
              `}
            >
              {t("n-characters-over-limit", { n: Math.abs(charactersLeft) })}
            </span>
          )}
        </div>

        {(error || mutation.isError) && (
          <div
            className={css`
              color: ${baseTheme.colors.red[600]};
              margin-bottom: 1rem;
              font-size: 0.875rem;
            `}
          >
            {error || t("failed-to-submit", { error: mutation.error })}
          </div>
        )}

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
          <Button
            variant="tertiary"
            size="medium"
            onClick={addComment}
            disabled={comment.length === 0}
            className={css`
              min-width: 100px;
              width: 100%;

              ${respondToOrLarger.xxs} {
                width: auto;
              }
            `}
          >
            {t("add-comment")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            onClick={() => mutation.mutate(comments)}
            disabled={comments.length === 0}
            className={css`
              min-width: 100px;
              width: 100%;
              background: ${baseTheme.colors.green[600]};
              border-color: ${baseTheme.colors.green[600]};
              color: ${baseTheme.colors.primary[100]};

              ${respondToOrLarger.xxs} {
                width: auto;
              }

              &:hover {
                background: ${baseTheme.colors.green[700]};
                border-color: ${baseTheme.colors.green[700]};
              }

              &:disabled {
                background: ${baseTheme.colors.gray[400]};
                border-color: ${baseTheme.colors.gray[400]};
              }
            `}
          >
            {t("send")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FeedbackDialog
