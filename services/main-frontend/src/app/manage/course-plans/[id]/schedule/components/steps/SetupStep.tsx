"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { CourseDesignerCourseSize } from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import { baseTheme } from "@/shared-module/common/styles"

const toolbarStyles = css`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
`

const fieldStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;

  label {
    font-weight: 600;
    color: ${baseTheme.colors.gray[700]};
    font-size: 0.9rem;
    margin-bottom: 0.15rem;
  }

  input[type="month"],
  select {
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    border: 1px solid ${baseTheme.colors.gray[300]};
    font-size: 1rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;

    :focus {
      outline: none;
      border-color: ${baseTheme.colors.green[500]};
      box-shadow: 0 0 0 3px ${baseTheme.colors.green[100]};
    }
  }
`

const wizardNavStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
`

interface SetupStepProps {
  courseSize: CourseDesignerCourseSize
  startsOnMonth: string
  isGeneratingSuggestion: boolean
  onCourseSizeChange: (value: CourseDesignerCourseSize) => void
  onStartsOnMonthChange: (value: string) => void
  onBack: () => void
  onContinue: () => void
}

export default function SetupStep({
  courseSize,
  startsOnMonth,
  isGeneratingSuggestion,
  onCourseSizeChange,
  onStartsOnMonthChange,
  onBack,
  onContinue,
}: SetupStepProps) {
  const { t } = useTranslation()

  return (
    <>
      <h2>{t("course-plans-wizard-step-size-and-date")}</h2>

      <div className={toolbarStyles}>
        <div className={fieldStyles}>
          <label htmlFor="course-size">{t("course-plans-course-size-label")}</label>
          <select
            id="course-size"
            value={courseSize}
            onChange={(event) => onCourseSizeChange(event.target.value as CourseDesignerCourseSize)}
          >
            <option value="small">{t("course-plans-course-size-small")}</option>
            <option value="medium">{t("course-plans-course-size-medium")}</option>
            <option value="large">{t("course-plans-course-size-large")}</option>
          </select>
        </div>

        <div className={fieldStyles}>
          <label htmlFor="starts-on-month">{t("course-plans-wizard-starts-on-month-label")}</label>
          <input
            id="starts-on-month"
            type="month"
            value={startsOnMonth}
            onChange={(event) => onStartsOnMonthChange(event.target.value)}
          />
        </div>
      </div>

      <div className={wizardNavStyles}>
        <Button variant="secondary" size="medium" onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          variant="primary"
          size="medium"
          onClick={onContinue}
          disabled={!startsOnMonth.trim() || isGeneratingSuggestion}
        >
          {isGeneratingSuggestion ? t("loading") : t("continue")}
        </Button>
      </div>
    </>
  )
}
