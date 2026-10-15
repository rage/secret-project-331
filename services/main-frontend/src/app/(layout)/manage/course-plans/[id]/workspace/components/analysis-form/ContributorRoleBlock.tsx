"use client"

import type { TFunction } from "i18next"
import type { Control } from "react-hook-form"

import { nullIfEmpty, TextField } from "@/shared-module/components"

import {
  type AnalysisWorkspaceFormValues,
  contributorCardLeadStyles,
  contributorCardStyles,
  contributorCardTitleStyles,
  contributorDutiesStyles,
  type ContributorFieldKey,
  type CONTRIBUTOR_ROLES,
} from "./analysisFormDomain"

/**
 * One key contributor role: title, duties, then full-width assignees field.
 */
export default function ContributorRoleBlock(props: {
  control: Control<AnalysisWorkspaceFormValues>
  dutiesKey: (typeof CONTRIBUTOR_ROLES)[number]["dutiesKey"]
  field: ContributorFieldKey
  nameKey: (typeof CONTRIBUTOR_ROLES)[number]["nameKey"]
  t: TFunction
}) {
  const { control, dutiesKey, field, nameKey, t } = props
  return (
    <div className={contributorCardStyles}>
      <div className={contributorCardLeadStyles}>
        <p className={contributorCardTitleStyles}>{t(nameKey)}</p>
        <p className={contributorDutiesStyles}>
          {t("course-plans-analysis-role-responsibilities-label")}: {t(dutiesKey)}
        </p>
      </div>
      <TextField
        name={field}
        control={control}
        rules={nullIfEmpty}
        label={t("course-plans-analysis-assigned-persons")}
      />
    </div>
  )
}
