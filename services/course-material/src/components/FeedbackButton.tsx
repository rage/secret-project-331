import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import { useState } from "react"

import { postFeedback } from "../services/backend"
import Button from "../shared-module/components/Button"
import { courseMaterialBlockClass } from "../utils/constants"

interface Props {
  courseSlug: string
}

const FeedbackButton: React.FC<Props> = ({ courseSlug }) => {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState<string | null>(null)

  let buttonText
  if (open) {
    buttonText = "Close menu"
  } else {
    buttonText = "Give feedback"
  }

  async function submit(event: any) {
    event.preventDefault()
    if (feedback.length === 0) {
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
      setError(e)
      return
    }
    setFeedback("")
    setOpen(false)
  }

  const charactersLeft = 1000 - feedback.length
  return (
    <div
      className={css`
        background-color: white;
      `}
    >
      {error && <pre>{JSON.stringify(error, undefined, 2)}</pre>}
      <form hidden={!open}>
        <TextField
          multiline
          value={feedback}
          onChange={(ev) => {
            setError(null)
            setFeedback(ev.target.value)
          }}
        />
        <br />
        {charactersLeft < 500 && charactersLeft >= 0 && <div>{charactersLeft} characters left</div>}
        {charactersLeft < 0 && <div>{Math.abs(charactersLeft)} characters over the limit</div>}
        <Button
          size={"medium"}
          variant={"primary"}
          onClick={submit}
          disabled={feedback.length === 0 || charactersLeft < 0}
        >
          Submit
        </Button>
      </form>
      <Button
        size={"medium"}
        variant={"primary"}
        onClick={() => {
          setError(null)
          setOpen((open) => !open)
        }}
      >
        {buttonText}
      </Button>
    </div>
  )
}

export default FeedbackButton
