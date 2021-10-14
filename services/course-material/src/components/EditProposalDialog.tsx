import { css } from "@emotion/css"
import React from "react"
import { useMutation } from "react-query"

import { postProposedEdits } from "../services/backend"
import { NewProposedBlockEdit } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

interface Props {
  courseId: string
  pageId: string
  onSubmitSuccess: () => void
  close: () => unknown
  selectedBlockId: string | null
  clearSelectedBlockId: () => void
  edits: Map<string, NewProposedBlockEdit>
}

const EditProposalDialog: React.FC<Props> = ({
  courseId,
  pageId,
  onSubmitSuccess,
  close,
  selectedBlockId,
  clearSelectedBlockId,
  edits,
}) => {
  const mutation = useMutation(
    (block_edits: NewProposedBlockEdit[]) => {
      return postProposedEdits(courseId, { page_id: pageId, block_edits })
    },
    {
      onSuccess: () => {
        onSubmitSuccess()
        close()
      },
    },
  )

  let topMessage
  let bottomMessage
  let leftButton
  if (selectedBlockId !== null) {
    // currently editing block
    topMessage = "You've selected material for editing."
    bottomMessage = "Preview your changes or make more edits."
    leftButton = (
      <Button
        variant="primary"
        size="medium"
        onClick={clearSelectedBlockId}
        className={css`
          margin: 4px;
        `}
      >
        Preview
      </Button>
    )
  } else if (edits.size === 0) {
    // not editing a block and no existing edits
    topMessage = "Click on material to make it editable!"
    bottomMessage = null
    leftButton = null
  } else {
    // not editing and have existing edits
    topMessage = "You've made changes!"
    bottomMessage = "Do you want to send your changes?"
    leftButton = (
      <Button
        variant="primary"
        size="medium"
        onClick={() => mutation.mutate(Array.from(edits.values()))}
        className={css`
          margin: 4px;
        `}
      >
        Send
      </Button>
    )
  }

  return (
    <>
      <div
        className={css`
          max-width: 533px;
          background: #ffffff;
          border: 1px solid #c4c4c4;
          box-sizing: border-box;
          border-radius: 4px;

          position: fixed;
          right: 20px;
          bottom: 20px;
          margin-left: 20px;
          z-index: 100;
          display: flex;
          flex-direction: column;
        `}
      >
        <div
          className={css`
            font-family: Josefin Sans, sans-serif;
            font-weight: 600;
            font-size: 22px;
            line-height: 22px;
            color: #333333;

            margin: 16px;
          `}
        >
          {topMessage}
        </div>
        {mutation.isError && <div>Failed to submit: {mutation.error}</div>}
        <>
          <div
            className={css`
              height: 0px;
              border: 1px solid #eaeaea;
            `}
          />
          <div
            className={css`
              display: flex;
              flex-direction: row;
            `}
          >
            <div
              className={css`
                line-height: 19px;
                color: rgba(117, 117, 117, 0.8);

                margin: 15px;
                flex-grow: 1;
              `}
            >
              {bottomMessage}
            </div>
            {leftButton}
            <Button
              variant="secondary"
              size="medium"
              onClick={close}
              className={css`
                margin: 4px;
                margin-right: 8px;
              `}
            >
              Exit
            </Button>
          </div>
        </>
      </div>
    </>
  )
}

export default EditProposalDialog
