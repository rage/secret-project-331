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
      {feedback.selected_text && (
        <div>{t("selected-text", { "selected-text": feedback.selected_text })}</div>
      )}
      {!feedback.selected_text && <div>{t("no-selected-text")}</div>}
      <div>
        {t("blocks-visible-when-feedback-given")}
        <ul>
          {/* We don't currently save the order of the visible blocks, sorting them so that the order is at least somewhat deterministic in this view. */}
          {[...feedback.blocks]
            .sort((a, b) => a.text?.localeCompare(b.text ?? "") ?? 0)
            .map((b) => (
              <li key={b.id}>
                <div>{t("block-id", { id: b.id })}</div>
                <div>{t("block-contents", { text: b.text })}</div>
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
