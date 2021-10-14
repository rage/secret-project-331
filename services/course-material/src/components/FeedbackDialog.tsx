import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import React, { useState } from "react"
import { useMutation } from "react-query"

import { postFeedback } from "../services/backend"
import { FeedbackBlock } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import { courseMaterialBlockClass } from "../utils/constants"

interface Props {
  courseId: string
  lastSelection: string
  setLastSelection: (s: string) => void
  onSubmitSuccess: () => void
  close: () => unknown
}

interface Comment {
  selectedText: string
  comment: string
  relatedBlocks: Array<FeedbackBlock>
}

const FeedbackDialog: React.FC<Props> = ({
  courseId,
  lastSelection,
  setLastSelection,
  onSubmitSuccess,
  close,
}) => {
  const [comments, setComments] = useState<Array<Comment>>([])
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const mutation = useMutation(
    (comments: Comment[]) => {
      const feedback = comments.map((c) => {
        return {
          feedback_given: c.comment,
          selected_text: c.selectedText.length > 0 ? c.selectedText : null,
          related_blocks: c.relatedBlocks,
        }
      })
      return postFeedback(courseId, feedback)
    },
    {
      onSuccess: () => {
        onSubmitSuccess()
        close()
      },
    },
  )

  // attach a single comment to the feedback
  async function addComment() {
    setError("")
    if (comment.length === 0) {
      setError("Comment cannot be empty")
      return
    }
    if (charactersLeft <= 0) {
      setError("Comment is too long")
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
          z-index: 100;
          margin-left: 20px;
        `}
      >
        <div
          className={css`
            font-family: Josefin Sans, sans-serif;
            font-style: normal;
            font-weight: 600;
            font-size: 22px;
            line-height: 22px;
            color: #000000;

            margin: 20px;
          `}
        >
          Send feedback
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
            overflow-y: scroll;
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
                        font-family: Space Mono, sans-serif;
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
                    font-family: Lato, sans-serif;
                    font-style: normal;
                    font-weight: normal;
                    font-size: 16px;
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
                    font-family: Lato, sans-serif;
                    font-style: normal;
                    font-weight: normal;
                    font-size: 13px;
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
                  Delete
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
            No comments yet
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
            <div>You can comment on specific portions of the material by highlighting it.</div>
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
                Commenting on: {lastSelection}{" "}
              </div>
              <Button variant="tertiary" size="medium" onClick={() => setLastSelection("")}>
                Clear selection
              </Button>
            </>
          )}
          <TextField
            className={css`
              background: #f7f7f7;
              border: 1px solid #c4c4c4;
              box-sizing: border-box;
              border-radius: 2px;
            `}
            fullWidth
            multiline
            rows={3}
            value={comment}
            onChange={(ev) => setComment(ev.target.value)}
          />
          {charactersLeft >= 0 && charactersLeft < 200 && (
            <div>{charactersLeft} characters left</div>
          )}
          {charactersLeft < 0 && <div>{Math.abs(charactersLeft)} characters over the limit</div>}
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
              Failed to submit: {mutation.error}
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
            Add comment
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
            Send
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
            Close
          </Button>
        </div>
      </div>
    </>
  )
}

export default FeedbackDialog
