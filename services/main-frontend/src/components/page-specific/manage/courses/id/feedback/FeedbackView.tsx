import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { parseISO } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"

import { markAsRead } from "../../../../../../services/backend/feedback"
import { Feedback } from "../../../../../../shared-module/common/bindings"
import Accordion from "../../../../../../shared-module/common/components/Accordion"
import Button from "../../../../../../shared-module/common/components/Button"
import TimeComponent from "../../../../../../shared-module/common/components/TimeComponent"
import HideTextInSystemTests from "../../../../../../shared-module/common/components/system-tests/HideTextInSystemTests"
import useToastMutation from "../../../../../../shared-module/common/hooks/useToastMutation"
import { primaryFont, typography } from "../../../../../../shared-module/common/styles"

export interface FeedbackViewProps {
  feedback: Feedback
  setRead: (read: boolean) => void
}

const ImportantText = styled.div`
  white-space: pre-wrap;
  border: 1px solid #ccc;
  padding: 0.5rem;
  margin: 0;
  font-family: ${primaryFont};
`

const TextInformationWrapper = styled.div`
  margin-bottom: 1rem;
`

const FeedbackView: React.FC<React.PropsWithChildren<FeedbackViewProps>> = ({
  feedback,
  setRead,
}) => {
  const { t } = useTranslation()

  const markAsReadMutation = useToastMutation(
    () => {
      const toggled = !feedback.marked_as_read
      return markAsRead(feedback.id, toggled).then(() => {
        setRead(toggled)
      })
    },
    {
      notify: true,
      method: "POST",
    },
  )

  return (
    <div
      className={css`
        border: 1px solid #e5e5e5;
        margin-bottom: 2rem;
        margin-top: 2rem;
        padding: 1rem;
      `}
    >
      <h2
        className={css`
          font-size: ${typography.h6};
          margin-bottom: 0.5rem;
        `}
      >
        {t("title-feedback")}
      </h2>

      <TextInformationWrapper>
        {feedback.page_id && (
          <div>
            {t("label-page")} {feedback.page_title} <small>({feedback.page_url_path})</small>
          </div>
        )}
        <HideTextInSystemTests
          text={t("sent-by", { user: feedback.user_id ?? t("guest") })}
          testPlaceholder="Sent by: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
        <div>
          <TimeComponent
            boldLabel={false}
            label={t("label-created")}
            date={parseISO(feedback.created_at)}
          />
        </div>
      </TextInformationWrapper>

      <TextInformationWrapper>
        {t("feedback-given")}
        <ImportantText>{feedback.feedback_given}</ImportantText>
      </TextInformationWrapper>
      {feedback.selected_text && (
        <TextInformationWrapper>
          {t("selected-text")}
          <ImportantText>{feedback.selected_text}</ImportantText>
        </TextInformationWrapper>
      )}
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {feedback.blocks.length > 0 && (
          <Accordion variant="detail">
            <details>
              <summary>{t("text-visible-when-feedback-given")}</summary>
              <div>
                {[...feedback.blocks]
                  .sort((a, b) => a.text?.localeCompare(b.text ?? "") ?? 0)
                  .sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0))
                  .map((b) => (
                    <p
                      className={css`
                        margin-bottom: 0.5rem;
                      `}
                      key={b.id}
                    >
                      {b.text}
                    </p>
                  ))}
              </div>
            </details>
          </Accordion>
        )}
      </div>
      <Button
        onClick={() => {
          markAsReadMutation.mutate()
        }}
        variant={"secondary"}
        size={"medium"}
      >
        {feedback.marked_as_read ? t("button-mark-as-unread") : t("button-mark-as-read")}
      </Button>
    </div>
  )
}

export default FeedbackView
