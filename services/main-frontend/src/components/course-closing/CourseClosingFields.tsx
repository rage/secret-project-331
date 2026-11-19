"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  DateTimeLocalField,
  Infobox,
  nullIfEmpty,
  Select,
  Switch,
  TextArea,
  type SelectOption,
  type SelectOptionGroup,
} from "@/shared-module/components"

import type { ClosingSuccessorCandidate } from "./closingSuccessorCandidates"
import CourseClosingStatus from "./CourseClosingStatus"

/** Form fields that `CourseClosingFields` reads and writes. */
export interface CourseClosingFormValues {
  set_course_closed_at: boolean
  closed_at?: string | null
  closed_additional_message?: string | null
  closed_course_successor_id?: string | null
}

interface CourseClosingFieldsProps {
  /** Courses to offer as the newer version; the course being edited is filtered out. */
  candidates: readonly ClosingSuccessorCandidate[]
  isLoadingCandidates?: boolean
  currentCourseId: string
  currentOrganizationId: string
  currentLanguageCode: string
  /** Group candidates by organization (current first) instead of by language. */
  groupByOrganization?: boolean
}

const NO_SUCCESSOR_VALUE = ""
const SECONDARY_SEPARATOR = " · "
const WARNING_TONE = "warning"

const containerStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const subheadingStyles = css`
  margin: 0.5rem 0 0;
  font-size: 1rem;
  font-weight: 600;
`

const secondaryStyles = css`
  margin-left: 0.5rem;
  color: var(--color-gray-500);
  font-size: 0.875em;
`

const mutedStyles = css`
  margin: 0;
  color: var(--color-gray-500);
`

const compareByName = (a: ClosingSuccessorCandidate, b: ClosingSuccessorCandidate) =>
  a.name.localeCompare(b.name)

/**
 * Switch, closing time, newer version and student note for scheduling a course closing.
 * Render inside a `FormProvider` whose values include {@link CourseClosingFormValues}; the caller
 * maps the values to the API on submit, nulling `closed_at` when `set_course_closed_at` is off.
 */
const CourseClosingFields: React.FC<CourseClosingFieldsProps> = ({
  candidates,
  isLoadingCandidates = false,
  currentCourseId,
  currentOrganizationId,
  currentLanguageCode,
  groupByOrganization = false,
}) => {
  const { t } = useTranslation()
  const { control } = useFormContext<CourseClosingFormValues>()
  const [isScheduled, closedAt, successorId] = useWatch({
    control,
    name: ["set_course_closed_at", "closed_at", "closed_course_successor_id"],
  })

  const others = useMemo(
    () => candidates.filter((candidate) => candidate.id !== currentCourseId),
    [candidates, currentCourseId],
  )

  const options = useMemo(() => {
    const renderOption = (candidate: ClosingSuccessorCandidate): SelectOption => {
      const secondary = [
        candidate.languageCode,
        candidate.slug,
        ...(groupByOrganization ? [candidate.organizationName] : []),
      ].join(SECONDARY_SEPARATOR)
      const marker = candidate.isDraft
        ? t("draft")
        : candidate.isUnlisted
          ? t("unlisted")
          : undefined
      return {
        value: candidate.id,
        textValue: `${candidate.name} ${candidate.slug}`,
        isDisabled: candidate.isClosed,
        label: (
          <span>
            {candidate.name}
            <span className={secondaryStyles}>{secondary}</span>
            {marker && <span className={secondaryStyles}>{marker}</span>}
            {candidate.isClosed && (
              <span className={secondaryStyles}>{t("course-closing-successor-closed")}</span>
            )}
          </span>
        ),
      }
    }
    const group = (label: string, members: ClosingSuccessorCandidate[]): SelectOptionGroup => ({
      label,
      options: members.toSorted(compareByName).map((member) => renderOption(member)),
    })

    const groups: SelectOptionGroup[] = []
    if (groupByOrganization) {
      const byOrganization = new Map<string, ClosingSuccessorCandidate[]>()
      for (const candidate of others) {
        byOrganization.set(candidate.organizationId, [
          ...(byOrganization.get(candidate.organizationId) ?? []),
          candidate,
        ])
      }
      const ordered = [...byOrganization.entries()].toSorted(([idA, a], [idB, b]) =>
        idA === currentOrganizationId
          ? -1
          : idB === currentOrganizationId
            ? 1
            : (a[0]?.organizationName ?? "").localeCompare(b[0]?.organizationName ?? ""),
      )
      for (const [, members] of ordered) {
        groups.push(group(members[0]?.organizationName ?? "", members))
      }
    } else {
      const sameLanguage = others.filter(
        (candidate) => candidate.languageCode === currentLanguageCode,
      )
      const otherLanguages = others.filter(
        (candidate) => candidate.languageCode !== currentLanguageCode,
      )
      if (sameLanguage.length > 0) {
        groups.push(
          group(
            t("course-closing-successor-same-language", { code: currentLanguageCode }),
            sameLanguage,
          ),
        )
      }
      if (otherLanguages.length > 0) {
        groups.push(group(t("course-closing-successor-other-languages"), otherLanguages))
      }
    }

    const selectedIsKnown = !successorId || others.some((candidate) => candidate.id === successorId)
    const unknownSelected: SelectOption[] =
      selectedIsKnown || isLoadingCandidates
        ? []
        : [{ value: successorId as string, label: successorId as string }]

    return [
      { value: NO_SUCCESSOR_VALUE, label: t("course-closing-successor-none") },
      ...unknownSelected,
      ...groups,
    ]
  }, [
    others,
    groupByOrganization,
    currentOrganizationId,
    currentLanguageCode,
    successorId,
    isLoadingCandidates,
    t,
  ])

  const selectedSuccessor = others.find((candidate) => candidate.id === successorId)

  return (
    <div className={containerStyles} data-testid="course-closing-fields">
      <Switch
        control={control}
        name="set_course_closed_at"
        label={t("course-closing-switch-label")}
        description={
          isScheduled || closedAt
            ? t("course-closing-switch-description")
            : t("course-closing-switch-off-description")
        }
      />
      {isScheduled && (
        <>
          <DateTimeLocalField
            control={control}
            name="closed_at"
            label={t("course-closing-time-label")}
            description={t("course-closing-time-description")}
            isRequired
            rules={{ ...nullIfEmpty, required: t("course-closing-time-required") }}
            data-testid="closed-at-field"
          />
          <CourseClosingStatus closedAt={closedAt} />
          <h3 className={subheadingStyles}>{t("course-closing-subheading")}</h3>
          <Select
            control={control}
            name="closed_course_successor_id"
            label={t("course-closing-successor-label")}
            description={t("course-closing-successor-description")}
            options={options}
            searchEnabled
            searchPlaceholder={t("search")}
            data-testid="closed-successor-field"
          />
          {!isLoadingCandidates && others.length === 0 && (
            <p className={mutedStyles}>{t("course-closing-successor-empty")}</p>
          )}
          {selectedSuccessor?.isDraft && (
            <Infobox tone={WARNING_TONE}>{t("course-closing-successor-draft-warning")}</Infobox>
          )}
          <TextArea
            control={control}
            name="closed_additional_message"
            label={t("course-closing-note-label")}
            description={t("course-closing-note-description")}
            autoResize
            rules={nullIfEmpty}
          />
        </>
      )}
    </div>
  )
}

export default CourseClosingFields
