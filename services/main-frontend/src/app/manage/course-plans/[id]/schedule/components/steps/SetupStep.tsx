"use client"

import { css } from "@emotion/css"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerCourseSize } from "@/generated/api/types.generated"
import { Button, Select, YearMonthField } from "@/shared-module/components"

import { useSetupStepFields } from "../../hooks/useWizardStepFields"

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
  flex: 1 1 16rem;
  min-width: min(100%, 16rem);
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

  const { control } = useSetupStepFields({
    courseSize,
    startsOnMonth,
    onCourseSizeChange,
    onStartsOnMonthChange,
  })

  const courseSizeOptions = useMemo(
    () => [
      // oxlint-disable-next-line i18next/no-literal-string
      { value: "small", label: t("course-plans-course-size-small") },
      // oxlint-disable-next-line i18next/no-literal-string
      { value: "medium", label: t("course-plans-course-size-medium") },
      // oxlint-disable-next-line i18next/no-literal-string
      { value: "large", label: t("course-plans-course-size-large") },
    ],
    [t],
  )

  return (
    <>
      <h2>{t("course-plans-wizard-step-size-and-date")}</h2>

      <div className={toolbarStyles}>
        <div className={fieldStyles}>
          <Select
            id="course-size"
            name="courseSize"
            control={control}
            label={t("course-plans-course-size-label")}
            options={courseSizeOptions}
          />
        </div>

        <div className={fieldStyles}>
          <YearMonthField
            id="starts-on-month"
            name="startsOnMonth"
            control={control}
            label={t("course-plans-wizard-starts-on-month-label")}
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
