"use client"

import { css } from "@emotion/css"
import { ArrowDown, Trash, UpArrow } from "@vectopus/atlas-icons-react"
import { type Control, useFieldArray } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Button, TextField } from "@/shared-module/components"

import AddListItemButton from "./AddListItemButton"
import {
  DESIGN_FORM_LIMITS,
  type DesignFormValues,
  maxLengthRules,
  newChapter,
  newTopic,
} from "./designFormDomain"
import { designListStyles, ICON_SIZE_BUTTON } from "./designFormStyles"
import TextListEditor from "./TextListEditor"

const chapterCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.clear[50]};
`

const chapterHeaderStyles = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
`

const chapterHeadingStyles = css`
  font-size: 1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const buttonGroupStyles = css`
  display: flex;
  gap: 0.25rem;
`

const subheadingStyles = css`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0;
`

const pageListStyles = css`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`

const fixedPageStyles = css`
  padding: 0.55rem 0.75rem;
  border-radius: 0.375rem;
  background: ${baseTheme.colors.gray[100]};
  color: ${baseTheme.colors.gray[700]};
  font-size: 0.9rem;
`

const fixedPageHintStyles = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.8rem;
  margin-left: 0.5rem;
`

const topicRowStyles = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.5rem;
`

/** Move up, move down and remove buttons for one row of an ordered list. */
function RowActions(props: {
  index: number
  count: number
  moveUpLabel: string
  moveDownLabel: string
  removeLabel: string
  onMove: (from: number, to: number) => void
  onRemove: (index: number) => void
}) {
  const { index, count, moveUpLabel, moveDownLabel, removeLabel, onMove, onRemove } = props
  return (
    <div className={buttonGroupStyles}>
      <Button
        type="button"
        variant="icon"
        size="small"
        icon={<UpArrow size={ICON_SIZE_BUTTON} />}
        aria-label={moveUpLabel}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      />
      <Button
        type="button"
        variant="icon"
        size="small"
        icon={<ArrowDown size={ICON_SIZE_BUTTON} />}
        aria-label={moveDownLabel}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      />
      <Button
        type="button"
        variant="icon"
        size="small"
        icon={<Trash size={ICON_SIZE_BUTTON} />}
        aria-label={removeLabel}
        onClick={() => onRemove(index)}
      />
    </div>
  )
}

function ChapterTopics(props: {
  control: Control<DesignFormValues>
  chapterIndex: number
  chapterNumber: number
}) {
  const { control, chapterIndex, chapterNumber } = props
  const { t } = useTranslation()
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `chapters.${chapterIndex}.topics`,
    keyName: "fieldKey",
  })

  return (
    <div className={designListStyles}>
      <p className={subheadingStyles}>{t("course-plans-design-chapter-pages")}</p>
      <ol className={pageListStyles}>
        <li className={fixedPageStyles}>
          {t("course-plans-design-chapter-introduction")}
          <span className={fixedPageHintStyles}>
            {t("course-plans-design-chapter-introduction-hint")}
          </span>
        </li>
        {fields.map((field, index) => (
          <li key={field.fieldKey} className={topicRowStyles}>
            <TextField
              name={`chapters.${chapterIndex}.topics.${index}.title`}
              control={control}
              rules={maxLengthRules(t, DESIGN_FORM_LIMITS.shortTextChars)}
              label={t("course-plans-design-topic-label", { number: index + 1 })}
            />
            <RowActions
              index={index}
              count={fields.length}
              moveUpLabel={t("course-plans-design-topic-move-up", {
                number: index + 1,
                chapter: chapterNumber,
              })}
              moveDownLabel={t("course-plans-design-topic-move-down", {
                number: index + 1,
                chapter: chapterNumber,
              })}
              removeLabel={t("course-plans-design-topic-remove", {
                number: index + 1,
                chapter: chapterNumber,
              })}
              onMove={move}
              onRemove={remove}
            />
          </li>
        ))}
        <li className={fixedPageStyles}>
          {t("course-plans-design-chapter-conclusion")}
          <span className={fixedPageHintStyles}>
            {t("course-plans-design-chapter-conclusion-hint")}
          </span>
        </li>
      </ol>
      <AddListItemButton
        label={t("course-plans-design-topic-add")}
        itemCount={fields.length}
        maxItems={DESIGN_FORM_LIMITS.listItems}
        onAdd={() => append(newTopic())}
      />
    </div>
  )
}

/** Chapters of the planned course, each with learning objectives and topic pages, in order. */
export default function CourseStructureEditor(props: { control: Control<DesignFormValues> }) {
  const { control } = props
  const { t } = useTranslation()
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "chapters",
    keyName: "fieldKey",
  })

  return (
    <div className={designListStyles}>
      {fields.map((field, index) => {
        const chapterNumber = index + 1
        const headingId = `design-chapter-${field.fieldKey}`
        return (
          <section key={field.fieldKey} className={chapterCardStyles} aria-labelledby={headingId}>
            <div className={chapterHeaderStyles}>
              <h4 className={chapterHeadingStyles} id={headingId}>
                {t("course-plans-design-chapter-heading", { number: chapterNumber })}
              </h4>
              <RowActions
                index={index}
                count={fields.length}
                moveUpLabel={t("course-plans-design-chapter-move-up", { number: chapterNumber })}
                moveDownLabel={t("course-plans-design-chapter-move-down", {
                  number: chapterNumber,
                })}
                removeLabel={t("course-plans-design-chapter-remove", { number: chapterNumber })}
                onMove={move}
                onRemove={remove}
              />
            </div>
            <TextField
              name={`chapters.${index}.title`}
              control={control}
              rules={maxLengthRules(t, DESIGN_FORM_LIMITS.shortTextChars)}
              label={t("course-plans-design-chapter-title")}
            />
            <p className={subheadingStyles}>{t("course-plans-design-chapter-objectives")}</p>
            <TextListEditor
              control={control}
              name={`chapters.${index}.learning_objectives`}
              itemLabel={(position) =>
                t("course-plans-design-objective-label", { number: position })
              }
              removeLabel={(position) =>
                t("course-plans-design-objective-remove", {
                  number: position,
                  chapter: chapterNumber,
                })
              }
              addLabel={t("course-plans-design-objective-add")}
              rows={1}
            />
            <ChapterTopics control={control} chapterIndex={index} chapterNumber={chapterNumber} />
          </section>
        )
      })}
      <AddListItemButton
        label={t("course-plans-design-chapter-add")}
        itemCount={fields.length}
        maxItems={DESIGN_FORM_LIMITS.listItems}
        onAdd={() => append(newChapter())}
        variant="secondary"
      />
    </div>
  )
}
