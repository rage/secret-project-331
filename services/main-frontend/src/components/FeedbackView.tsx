import React from "react"
import { useTranslation } from "react-i18next"

import { markAsRead } from "../services/backend/feedback"
import { Feedback } from "../shared-module/bindings"
import Button from "../shared-module/components/Button"

export interface FeedbackViewProps {
  feedback: Feedback
  setRead: (read: boolean) => void
}

const FeedbackView: React.FC<FeedbackViewProps> = ({ feedback, setRead }) => {
  const { t } = useTranslation()
  function onClick() {
    const toggled = !feedback.marked_as_read
    markAsRead(feedback.id, toggled).then(() => {
      setRead(toggled)
    })
  }

  return (
    <>
      <div>{t("feedback-given", { "feedback-given": feedback.feedback_given })}</div>
      <div>
        {t("blocks")}{" "}
        <ul>
          {feedback.blocks.map((b) => (
            <li key={b.id}>
              <div>{t("block-id", { id: b.id })}</div>
              <div>{t("selected-contents", { text: b.text })}</div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {t("sent-by-at", { user: feedback.user_id, time: feedback.created_at.toISOString() })}
      </div>
      <Button onClick={onClick} variant={"primary"} size={"medium"}>
        {feedback.marked_as_read ? t("button-mark-as-unread") : t("button-mark-as-read")}
      </Button>
    </>
  )
}

export default FeedbackView
