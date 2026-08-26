"use client"

import { css } from "@emotion/css"
import type { UseMutationResult } from "@tanstack/react-query"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { Button } from "@/shared-module/components"

interface ChatbotOption {
  label: string
  courseId: string | null | undefined
  options: {
    label: string
    value: string
  }[]
}

interface NewConversationDialogProps {
  chatbotOptions: ChatbotOption[]
  setConfigurationId: React.Dispatch<string>
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  open: boolean
  onClose: () => void
}

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  chatbotOptions,
  setConfigurationId,
  newConversationMutation,
  open,
  onClose,
}) => {
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
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  `

  return (
    <StandardDialog open={open} onClose={onClose} title={"Chatbot selection"}>
      <div>
        <ul
          className={css`
            padding: 0;
          `}
        >
          {chatbotOptions.map((category) => (
            <li className={sectionCss} key={category.courseId}>
              <span className={sectionHeadingCss}>{category.label}</span>
              <ul className={sectionGroupCss}>
                {category.options.map((option) => (
                  <Button
                    key={option.value}
                    onClick={() => {
                      setConfigurationId(option.value)
                      newConversationMutation.mutate()
                      onClose()
                    }}
                    variant="icon"
                    className={css`
                      width: 100%;
                      justify-content: flex-start;
                      transition: background-color 0.2s;

                      &:hover:not(:disabled):not([aria-disabled="true"]) {
                        background: var(--color-green-75);
                        border-color: var(--color-green-300);
                      }
                      color: var(--field-fg);
                    `}
                  >
                    <li>
                      <span
                        className={css`
                          font-weight: 400;
                        `}
                      >
                        {option.label}
                      </span>
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
