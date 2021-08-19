import { css } from "@emotion/css"
import { Dialog, TextField } from "@material-ui/core"
import React, { useState } from "react"

import { postFeedback } from "../services/backend"
import Button from "../shared-module/components/Button"
import { courseMaterialBlockClass } from "../utils/constants"

interface Props {
  courseSlug: string
  selection: string
  open: boolean
  onSubmitSuccess: () => void
  close: () => unknown
}

const FeedbackDialog: React.FC<Props> = ({
  courseSlug,
  selection,
  open,
  onSubmitSuccess,
  close,
}) => {
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit(event: any) {
    event.preventDefault()
    setError("")

    if (feedback.length === 0) {
      setError("Feedback cannot be empty")
      return
    }

    const relatedBlocks = []
    const blocks = document.getElementsByClassName(courseMaterialBlockClass)
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      const rect = block.getBoundingClientRect()
      const topBelowScreen = rect.top > window.innerHeight
      const bottomAboveScreen = rect.bottom < 0
      const onScreen = !bottomAboveScreen && !topBelowScreen
      if (onScreen) {
        relatedBlocks.push({
          id: block.id,
          text: block.textContent,
        })
      }
    }

    try {
      await postFeedback(courseSlug, {
        feedback_given: feedback,
        related_blocks: relatedBlocks,
      })
    } catch (e) {
      console.error(e)
      setError(e.toString())
      return
    }
    setFeedback("")
    onSubmitSuccess()
    close()
  }

  const charactersLeft = 1000 - feedback.length
  return (
    <Dialog open={open}>
      <div
        className={css`
          margin: 8px;
          width: 550px;
        `}
      >
        <h2>Send feedback</h2>
        <form>
          <TextField
            value={feedback}
            onChange={(ev) => setFeedback(ev.target.value)}
            placeholder={"Write your feedback here"}
            className={css`
              width: 100%;
            `}
            multiline
            rows={6}
          />
        </form>
        {charactersLeft > 0 && charactersLeft < 500 && <div>{charactersLeft} characters left</div>}
        {charactersLeft < 0 && <div>{Math.abs(charactersLeft)} characters over the limit</div>}
        {error && <div>Error: {error}</div>}
        <Button variant={"primary"} size={"medium"} disabled={charactersLeft < 0} onClick={submit}>
          Submit
        </Button>
        <Button
          variant={"secondary"}
          size={"medium"}
          onClick={() => {
            setFeedback("")
            close()
          }}
        >
          Cancel
        </Button>
        <div>Selected material:</div>
        <div
          className={css`
            max-height: 100px;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
            overflow-y: scroll;
          `}
        >
          {selection}
        </div>
      </div>
    </Dialog>
  )
}

export default FeedbackDialog
