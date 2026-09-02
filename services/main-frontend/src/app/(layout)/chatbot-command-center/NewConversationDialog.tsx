"use client"

import { css } from "@emotion/css"
import { useAutocompleteState } from "@react-stately/autocomplete"
import { useSearchFieldState } from "@react-stately/searchfield"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import { useMemo, useRef, useState } from "react"
import { useAutocomplete, useFilter, useSearchField } from "react-aria"
import { useTranslation } from "react-i18next"

import { useChatbotContext } from "@/components/course-material/chatbot/shared/ChatbotContext"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { Button } from "@/shared-module/components"
import { listBoxEmptyStateCss } from "@/shared-module/components/components/primitives/selectStyles"

interface NewConversationDialogProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  setConfigurationId: React.Dispatch<string>
  open: boolean
  onClose: () => void
}

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

const searchfieldCss = css`
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 999px;
  padding: 0 2rem;
  width: 100%;
  outline: none;
  border: none;
  box-shadow: inset 0 0 0 1px var(--field-border);
  min-height: 2.5rem;
  &:focus-visible {
    box-shadow: none;
    outline: 2px solid var(--field-border-color-focus);
  }
`

const buttonCss = css`
  width: 100%;
  justify-content: flex-start;
  transition: background-color 0.2s;

  &:hover:not(:disabled):not([aria-disabled="true"]) {
    background: var(--color-green-75);
    border-color: var(--color-green-300);
  }
  color: var(--field-fg);
`

const NewConversationDialog: React.FC<NewConversationDialogProps> = ({
  chatbots,
  courses,
  setConfigurationId,
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const [filterValue, setFilterValue] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef(null)

  const { newConversationMutation } = useChatbotContext()

  let { contains } = useFilter({
    // oxlint-disable-next-line i18next/no-literal-string
    sensitivity: "base",
  })

  const chatbotOptions = useMemo(() => {
    const grouped = Object.values(
      chatbots.reduce(
        (acc, chatbot) => {
          const matched = courses.find((course) => course.id === chatbot.course_id)
          const courseName =
            matched !== undefined ? matched.name : t("select-chatbot-globals-title")

          // oxlint-disable-next-line i18next/no-literal-string
          const groupId = chatbot.course_id ?? "globals"

          if (!acc[groupId]) {
            acc[groupId] = {
              label: courseName,
              courseId: chatbot.course_id,
              options: [],
            }
          }
          acc[groupId].options.push({
            label: chatbot.chatbot_name,
            value: chatbot.id,
          })

          return acc
        },
        {} as Record<
          string,
          {
            label: string
            courseId: string | null | undefined
            options: { label: string; value: string }[]
          }
        >,
      ),
    )

    const groupedSorted = grouped.toSorted((a, b) => {
      if (!a.courseId && b.courseId) {
        return -1
      }
      if (a.courseId && !b.courseId) {
        return 1
      }
      return a.label.localeCompare(b.label)
    })
    return groupedSorted
  }, [courses, chatbots, t])

  const chatbotOptionsFiltered =
    searchRef.current === document.activeElement
      ? chatbotOptions
          .map((category) => ({
            ...category,
            options: category.options.filter((option) => contains(option.label, filterValue)),
          }))
          .filter((category) => category.options.length > 0)
      : chatbotOptions

  const searchFieldState = useSearchFieldState({
    value: filterValue,
    onChange: setFilterValue,
  })

  const autoCompleteState = useAutocompleteState({})

  const { inputProps: autoCompleteInputProps } = useAutocomplete(
    {
      inputRef: searchRef,
      collectionRef: listRef,
    },
    autoCompleteState,
  )

  // oxlint-disable-next-line i18next/no-literal-string
  const { inputProps } = useSearchField(
    // oxlint-disable-next-line i18next/no-literal-string
    { ...autoCompleteInputProps, placeholder: "search", "aria-label": "search" },
    searchFieldState,
    searchRef,
  )

  return (
    <StandardDialog
      leftAlignTitle
      isDismissable
      open={open}
      onClose={onClose}
      title={t("new-conversation-dialog-title")}
    >
      <div
        className={css`
          position: relative;
          padding: 0 6px;
        `}
      >
        <span
          className={css`
            display: inline-block;
            position: absolute;
            left: 1rem;
            top: 1.125rem;
          `}
        >
          <MagnifyingGlass size={16} weight="bold" />
        </span>
        <input {...inputProps} ref={searchRef} className={searchfieldCss} />
      </div>
      <ul
        className={css`
          padding: 0;
          height: 400px;
          overflow: auto;
        `}
      >
        {chatbotOptionsFiltered.length === 0 ? (
          <div className={listBoxEmptyStateCss} role="presentation">
            {t("listBox.noResults")}
          </div>
        ) : (
          chatbotOptionsFiltered.map((category) => (
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
                    className={buttonCss}
                    aria-label={t("select-chatbot", { title: option.label })}
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
          ))
        )}
      </ul>
    </StandardDialog>
  )
}

export default NewConversationDialog
