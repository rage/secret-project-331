"use client"

import { css } from "@emotion/css"
import React from "react"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Button, Checkbox } from "@/shared-module/components"

import {
  contentRowStyles,
  FieldSet,
  formButtonGridStyles,
  Legend,
  type CourseDataFilter,
} from "./page"

interface Props {
  methods: UseFormReturn<CourseDataFilter>
}

const CourseDataFilterForm: React.FC<Props> = ({ methods }) => {
  const { t } = useTranslation()

  const { control, watch, reset, setValue } = methods

  const [
    showDescription,
    showPrerequisites,
    showAudiences,
    showSuggestMetadata,
    showClosedAt,
    showClosedCourseSuccessorId,
    showAdditionalMessage,
    showCompletionRegistrationLink,
    showEnableRegisterinCompletionToUhOpenUniversity,
    showUhCourseCode,
    showEctsCredits,
  ] = watch([
    "show_description",
    "show_prerequisites",
    "show_audiences",
    "show_suggest_metadata",
    "show_closed_at",
    "show_closed_course_successor_id",
    "show_additional_message",
    "show_completion_registration_link",
    "show_enable_registering_completion_to_uh_open_university",
    "show_uh_course_code",
    "show_ects_credits",
  ])

  const allSelectedMetadata = Boolean(
    showDescription && showPrerequisites && showAudiences && showSuggestMetadata,
  )

  const handleToggleAllMetadata = () => {
    const next = !allSelectedMetadata
    setValue("show_description", next, { shouldDirty: true })
    setValue("show_prerequisites", next, {
      shouldDirty: true,
    })
    setValue("show_audiences", next, { shouldDirty: true })
    setValue("show_suggest_metadata", next, { shouldDirty: true })
  }

  const allSelectedClosedAtData = Boolean(
    showClosedAt && showClosedCourseSuccessorId && showAdditionalMessage,
  )

  const handleToggleAllClosedAtData = () => {
    const next = !allSelectedClosedAtData
    setValue("show_closed_at", next, { shouldDirty: true })
    setValue("show_closed_course_successor_id", next, {
      shouldDirty: true,
    })
    setValue("show_additional_message", next, { shouldDirty: true })
  }

  const allSelectedModuleData = Boolean(
    showCompletionRegistrationLink &&
    showEnableRegisterinCompletionToUhOpenUniversity &&
    showUhCourseCode &&
    showEctsCredits,
  )

  const handleToggleAllModuleData = () => {
    const next = !allSelectedModuleData
    setValue("show_completion_registration_link", next, { shouldDirty: true })
    setValue("show_enable_registering_completion_to_uh_open_university", next, {
      shouldDirty: true,
    })
    setValue("show_uh_course_code", next, { shouldDirty: true })
    setValue("show_ects_credits", next, { shouldDirty: true })
  }

  return (
    <FieldSet>
      <Legend>{t("course-auditing-filter-course-data-title")}</Legend>

      <div className={contentRowStyles}>
        <div className={formButtonGridStyles}>
          <p
            className={css`
              font-weight: 500;
            `}
          >
            {t("course-auditing-filter-metadata-title")}
          </p>
          <label
            className={css`
              color: ${baseTheme.colors.gray[800]};
              display: inline-flex;
              align-items: center;
              gap: var(--space-2, 0.5rem);
              cursor: pointer;
            `}
          >
            <input
              type="checkbox"
              checked={allSelectedMetadata}
              onChange={handleToggleAllMetadata}
            />
            {t("course-auditing-filter-checkbox-all")}
          </label>
          <Checkbox
            name="show_description"
            control={control}
            label={t("course-auditing-filter-description")}
          />
          <Checkbox
            name="show_prerequisites"
            control={control}
            label={t("course-auditing-filter-prerequisites")}
          />
          <Checkbox
            name="show_audiences"
            control={control}
            label={t("course-auditing-filter-audiences")}
          />
          <Checkbox
            name="show_suggest_metadata"
            control={control}
            label={t("course-auditing-filter-suggest-metadata-button")}
          />
        </div>

        <div className={formButtonGridStyles}>
          <p
            className={css`
              font-weight: 500;
            `}
          >
            {t("course-auditing-filter-closed-at-data-title")}
          </p>
          <label
            className={css`
              color: ${baseTheme.colors.gray[800]};
              display: inline-flex;
              align-items: center;
              gap: var(--space-2, 0.5rem);
              cursor: pointer;
            `}
          >
            <input
              type="checkbox"
              checked={allSelectedClosedAtData}
              onChange={handleToggleAllClosedAtData}
            />
            {t("course-auditing-filter-checkbox-all")}
          </label>
          <Checkbox
            name="show_closed_at"
            control={control}
            label={t("course-auditing-filter-closed-at")}
          />
          <Checkbox
            name="show_closed_course_successor_id"
            control={control}
            label={t("course-auditing-filter-closed-course-successor-id")}
          />
          <Checkbox
            name="show_additional_message"
            control={control}
            label={t("course-auditing-filter-additional-message")}
          />
        </div>

        <div className={formButtonGridStyles}>
          <p
            className={css`
              font-weight: 500;
            `}
          >
            {t("course-auditing-filter-module-data-title")}
          </p>
          <label
            className={css`
              color: ${baseTheme.colors.gray[800]};
              display: inline-flex;
              align-items: center;
              gap: var(--space-2, 0.5rem);
              cursor: pointer;
            `}
          >
            <input
              type="checkbox"
              checked={allSelectedModuleData}
              onChange={handleToggleAllModuleData}
            />
            {t("course-auditing-filter-checkbox-all")}
          </label>
          <Checkbox
            name="show_completion_registration_link"
            control={control}
            label={t("course-auditing-filter-completion-registration-link")}
          />
          <Checkbox
            name="show_enable_registering_completion_to_uh_open_university"
            control={control}
            label={t("course-auditing-filter-enable-registering-completion-to-uh-open-university")}
          />
          <Checkbox
            name="show_uh_course_code"
            control={control}
            label={t("course-auditing-filter-uh-course-code")}
          />
          <Checkbox
            name="show_ects_credits"
            control={control}
            label={t("course-auditing-filter-ects-credits")}
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          size="medium"
          onClick={() => reset()}
          aria-label={t("course-auditing-reset-filter-aria")}
        >
          {t("button-reset")}
        </Button>
      </div>
    </FieldSet>
  )
}

export default CourseDataFilterForm
