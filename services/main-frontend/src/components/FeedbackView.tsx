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
      <div>{`Target: "${feedback.feedback_target_text}"`}</div>
      <div>{`Feedback: "${feedback.feedback_given}"`}</div>
      <div>
        Blocks:{" "}
        <ul>
          {feedback.block_ids.map((f) => (
            <li key={f}>{f}</li>
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
