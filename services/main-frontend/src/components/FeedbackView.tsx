import React from "react"

import { markAsRead } from "../services/backend/feedback"
import { Feedback } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

export interface FeedbackViewProps {
  feedback: Feedback
  setRead: (read: boolean) => void
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ feedback, setRead }) => {
  function onClick() {
    const toggled = !feedback.marked_as_read
    markAsRead(feedback.id, toggled).then(() => {
      setRead(toggled)
    })
  }

  return (
    <>
      <div>{`Feedback: "${feedback.feedback_given}"`}</div>
      {feedback.selected_text && <div>{`Selected text: "${feedback.selected_text}"`}</div>}
      {!feedback.selected_text && <div>{`No selected text`}</div>}
      <div>
        Blocks:{" "}
        <ul>
          {feedback.blocks.map((b) => (
            <li key={b.id}>
              <div>Block id: {b.id}</div>
              <div>Block contents: {b.text}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        Sent by {feedback.user_id} at {feedback.created_at.toISOString()}
      </div>
      <Button onClick={onClick} variant={"primary"} size={"medium"}>
        Mark as {feedback.marked_as_read ? "unread" : "read"}
      </Button>
    </>
  )
}

export default FeedbackView
