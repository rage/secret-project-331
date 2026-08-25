"use client"

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { Button } from "@/shared-module/components"
import { listBoxOptionCss } from "@/shared-module/components/components/primitives/selectStyles"

interface NewConversationDialogProps {
  chatbotOptions
  setConversationId: React.Dispatch<string>
  setConfigurationId: React.Dispatch<string>
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  open: boolean
  onClose: () => void
}

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  chatbotOptions,
  setConversationId,
  setConfigurationId,
  newConversationMutation,
  open,
  onClose,
}) => {
  const { t } = useTranslation()

  const sectionCss = css`
    display: grid;
    gap: var(--space-1);
  `

  const sectionHeadingCss = css`
    padding: var(--space-2) var(--space-3) 0;
    color: var(--field-label-color);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.35;
  `

  const sectionGroupCss = css`
    margin: 0;
    padding: 0;
    list-style: none;
  `

  return (
    <StandardDialog open={open} onClose={onClose} title={t("chatbot-preview-modal-title")}>
      <div>
        <ul>
          {chatbotOptions.map((category) => (
            <li className={sectionCss} key={category.courseId}>
              <span className={sectionHeadingCss}>{category.label}</span>
              <ul className={sectionGroupCss}>
                {category.options.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => {
                      setConversationId(null)
                      setConfigurationId(option.value)
                      newConversationMutation.mutate()
                      onClose()
                    }}
                  >
                    <li className={listBoxOptionCss}>
                      <span>{option.label}</span>
                    </li>
                  </Button>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </StandardDialog>
  )
}

export default NewConversationDialog
