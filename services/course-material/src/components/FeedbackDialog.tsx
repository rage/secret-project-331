import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { postFeedback } from "../services/backend"
import { courseMaterialBlockClass } from "../utils/constants"

import { FeedbackBlock } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { primaryFont } from "@/shared-module/common/styles"

interface Props {
  courseId: string
  pageId: string
  lastSelection: string
  setLastSelection: (s: string) => void
  close: () => unknown
}

interface Comment {
  selectedText: string
  comment: string
  relatedBlocks: Array<FeedbackBlock>
}

const FeedbackDialog: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pageId,
  lastSelection,
  setLastSelection,
  close,
}) => {
  const { t } = useTranslation()
  const [comments, setComments] = useState<Array<Comment>>([])
  const [comment, setComment] = useState("")
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
        close()
      },
    },
  )

  // attach a single comment to the feedback
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

    // get all visible blocks and attach them to the feedback
    const relatedBlocks: Array<FeedbackBlock> = []
    const blocks = document.getElementsByClassName(courseMaterialBlockClass)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      const rect = block.getBoundingClientRect()
      const topBelowScreen = rect.top > window.innerHeight
      const bottomAboveScreen = rect.bottom < 0
      const onScreen = !bottomAboveScreen && !topBelowScreen
      if (onScreen) {
        // limit block text length
        const text = block.textContent ? block.textContent.slice(0, 1000) : null
        relatedBlocks.push({
          id: block.id,
          text,
          order_number: relatedBlocks.length,
        })
      }
    }
    // limit selection length
    const selectedText = lastSelection.slice(0, 10000)
    setComments((cs) => [...cs, { comment, selectedText, relatedBlocks }])
    setComment("")
    setLastSelection("")
  }

  const charactersLeft = 1000 - comment.length
  return (
    <>
      <div
        className={css`
          position: fixed;
          max-width: 400px;
          background: #ffffff;
          border: 1px solid #c4c4c4;
          box-sizing: border-box;
          border-radius: 4px;

          bottom: 100px;
          right: 20px;
          z-index: 1100;
          margin-left: 20px;
        `}
      >
        <div
          className={css`
            font-family: ${primaryFont};
            font-style: normal;
            font-weight: 600;
            font-size: 22px;
            line-height: 22px;
            color: #000000;

            margin: 20px;
          `}
        >
          {t("send")}
        </div>
        <div
          className={css`
            height: 0px;
            border: 1px solid #eaeaea;
          `}
        />
        <div
          className={css`
            max-height: 300px;
            overflow-y: auto;
          `}
        >
          {comments.length > 0 &&
            comments.map((c, i) => (
              <div key={`${c}-${i}`}>
                {c.selectedText.length > 0 && (
                  <div
                    className={css`
                      background: rgba(196, 196, 196, 0.3);

                      overflow: hidden;
                      white-space: nowrap;
                      text-overflow: ellipsis;
                      margin: 16px;
                    `}
                  >
                    <span
                      className={css`
                        font-family:
                          Space Mono,
                          sans-serif;
                        font-style: normal;
                        font-weight: normal;
                        font-size: 16px;
                        line-height: 16px;
                        color: #3b4754;
                      `}
                    >
                      {c.selectedText}
                    </span>
                  </div>
                )}
                <div
                  className={css`
                    font-family: ${primaryFont};
                    font-style: normal;
                    font-weight: normal;
                    font-size: 1rem;
                    line-height: 20px;
                    color: #3b4754;

                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    margin: 18px;
                  `}
                >
                  {c.comment}
                </div>
                <button
                  className={css`
                    font-family: ${primaryFont};
                    font-style: normal;
                    font-weight: normal;
                    font-size: 0.813rem;
                    line-height: 16px;
                    color: rgba(117, 117, 117, 0.6);

                    margin-top: 5px;
                    margin-left: 26px;
                    cursor: pointer;
                    padding: 0;
                    border: none;
                    background: none;
                  `}
                  onClick={() =>
                    setComments((cs) => [...cs.slice(0, i), ...cs.slice(i + 1, cs.length)])
                  }
                >
                  {t("delete")}
                </button>
              </div>
            ))}
        </div>
        {comments.length === 0 && (
          <div
            className={css`
              margin: 16px;
            `}
          >
            {t("no-comments-yet")}
          </div>
        )}
        <div
          className={css`
            height: 0px;
            border: 1px solid #eaeaea;
          `}
        />
        <div
          className={css`
            margin: 31px;
          `}
        >
          {lastSelection.length === 0 && (
            <div>{t("can-comment-on-portions-of-material-by-highlightig")}</div>
          )}
          {lastSelection.length > 0 && (
            <>
              <div
                className={css`
                  overflow: hidden;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                `}
              >
                {t("commenting-on-selection", { selection: lastSelection })}{" "}
              </div>
              <Button variant="tertiary" size="medium" onClick={() => setLastSelection("")}>
                {t("clear-selection")}
              </Button>
            </>
          )}
          <TextAreaField
            value={comment}
            label={t("add-comment")}
            name=""
            onChangeByValue={(value) => setComment(value)}
            placeholder={t("write-your-feedback-here")}
          />
          {charactersLeft >= 0 && charactersLeft < 200 && (
            <div>{t("n-characters-left", { n: charactersLeft })}</div>
          )}
          {charactersLeft < 0 && (
            <div>{t("n-characters-over-limit", { n: Math.abs(charactersLeft) })}</div>
          )}
          {error && error?.length > 0 && (
            <div
              className={css`
                color: Crimson;
              `}
            >
              {error}
            </div>
          )}
          {mutation.isError && (
            <div
              className={css`
                color: Crimson;
              `}
            >
              {t("failed-to-submit", { error: mutation.error })}
            </div>
          )}
          <Button
            className={css`
              margin-top: 27px;
              margin-right: 0px;
            `}
            variant="tertiary"
            size="medium"
            onClick={addComment}
            disabled={comment.length === 0}
          >
            {t("add-comment")}
          </Button>
          <br />
          <Button
            className={css`
              margin-top: 27px;
              margin-right: 0px;
            `}
            variant="primary"
            size="medium"
            onClick={() => mutation.mutate(comments)}
            disabled={comments.length === 0}
          >
            {t("send")}
          </Button>
          <Button
            className={css`
              margin-top: 27px;
              margin-right: 0px;
            `}
            variant="secondary"
            size="medium"
            onClick={close}
          >
            {t("close")}
          </Button>
        </div>
      </div>
    </>
  )
}

export default FeedbackDialog
