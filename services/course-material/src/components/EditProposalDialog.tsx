import { css } from "@emotion/css"
import React, { useState } from "react"

import { postProposedEdits } from "../services/backend"
import { NewProposedBlockEdit } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

interface Props {
  courseId: string
  pageId: string
  onSubmitSuccess: () => void
  close: () => unknown
  edits: Map<string, NewProposedBlockEdit>
}

const FeedbackDialog: React.FC<Props> = ({ courseId, pageId, onSubmitSuccess, close, edits }) => {
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError("")

    try {
      const block_edits = Array.from(edits.values())
      postProposedEdits(courseId, { page_id: pageId, block_edits })
    } catch (err) {
      if (err instanceof Error) {
        setError(`Failed to send proposed edits: ${err.toString()}`)
      } else {
        setError("Failed to send proposed edits")
      }
      return
    }

    onSubmitSuccess()
    close()
  }

  return (
    <>
      <div
        className={css`
          width: 533px;
          height: 120px;
          background: #ffffff;
          border: 1px solid #c4c4c4;
          box-sizing: border-box;
          border-radius: 4px;

          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 100;
        `}
      >
        <div
          className={css`
            font-family: Josefin Sans, sans-serif;
            font-style: normal;
            font-weight: 600;
            font-size: 22px;
            line-height: 22px;
            color: #333333;

            margin: 16px;
          `}
        >
          You&apos;ve made a change!
        </div>
        <div
          className={css`
            height: 0px;
            border: 1px solid #eaeaea;
          `}
        />
        {error && <div>Error: {error}</div>}
        <span
          className={css`
            font-family: Lato, sans-serif;
            font-style: normal;
            font-weight: normal;
            font-size: 16px;
            line-height: 19px;
            color: rgba(117, 117, 117, 0.8);

            margin: 15px;
          `}
        >
          Do you want to save these changes?
        </span>
        <Button variant="primary" size="medium" onClick={send}>
          Send
        </Button>
        <Button variant="secondary" size="medium" onClick={close}>
          Exit
        </Button>
      </div>
    </>
  )
}

export default FeedbackDialog
