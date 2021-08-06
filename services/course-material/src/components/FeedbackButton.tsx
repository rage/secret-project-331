import { TextField } from "@material-ui/core"
import { useState } from "react"

import { postFeedback } from "../services/backend"
import Button from "../shared-module/components/Button"

interface Props {
  courseSlug: string
}

const FeedbackButton: React.FC<Props> = ({ courseSlug }) => {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState("")

  let buttonText
  if (open) {
    buttonText = "Close menu"
  } else {
    buttonText = "Give feedback"
  }

  function submit(event: any) {
    event.preventDefault()
    if (feedback.length === 0) {
      return
    }

    let visibleText = ""
    const visibleBlocks = []
    const blocks = document.getElementsByClassName("block")
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      const rect = block.getBoundingClientRect()
      const topBelowScreen = rect.top > window.innerHeight
      const bottomAboveScreen = rect.bottom < 0
      const onScreen = !bottomAboveScreen && !topBelowScreen
      if (onScreen) {
        if (visibleText.length > 0) {
          visibleText += "\n\n"
        }
        visibleText += block.textContent
        visibleBlocks.push(block.id)
      }
    }

    setFeedback("")
    postFeedback(courseSlug, {
      feedback_given: feedback,
      feedback_target_text: (window.getSelection() || "").toString(),
      related_blocks: visibleBlocks,
    }).then((_) => setOpen(false))
  }

  return (
    <div>
      <form hidden={!open}>
        <TextField multiline value={feedback} onChange={(ev) => setFeedback(ev.target.value)} />
        <br />
        <Button size={"medium"} variant={"primary"} onClick={submit}>
          Submit
        </Button>
      </form>
      <Button size={"medium"} variant={"primary"} onClick={() => setOpen((open) => !open)}>
        {buttonText}
      </Button>
    </div>
  )
}

export default FeedbackButton
