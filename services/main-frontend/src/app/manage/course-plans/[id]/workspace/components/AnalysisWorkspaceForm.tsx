"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import {
  AccountsGroupPeople,
  ArrowDown,
  CheckCircle,
  Coins,
  Document,
  Pencil,
  Statistics,
  Users,
} from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Control, UseFormSetValue } from "react-hook-form"
import { useForm, useFormState, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDebouncedCallback } from "use-debounce"

import {
  getCourseDesignerPlanQueryKey,
  updateCourseDesignerStageWorkspaceMutation,
} from "@/generated/api/@tanstack/react-query.generated"
import type {
  AnalysisCourseType,
  AnalysisWorkspaceV1,
  CourseDesignerStage,
} from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import {
  Checkbox,
  ComboBox,
  emptyStringToNull,
  nullIfEmpty,
  Select,
  stringToNumberOrNull,
  TextArea,
  TextField,
} from "@/shared-module/components"

const STAGE_ANALYSIS: CourseDesignerStage = "Analysis"
const FIELD_CREDITS = "credits"
const FIELD_LANGUAGE = "language"
const FIELD_COURSE_TYPE = "course_type"
const INPUT_MODE_DECIMAL = "decimal"
const MAILTO_PREFIX = "mailto:"
const EXTERNAL_LINK_TARGET = "_blank"
const EXTERNAL_LINK_REL = "noopener noreferrer"
const OPEN_PERIOD_I = "open_period_i"
const OPEN_PERIOD_II = "open_period_ii"
const OPEN_PERIOD_III = "open_period_iii"
const OPEN_PERIOD_IV = "open_period_iv"
const FIELD_MODE_SYNCHRONOUS = "mode_synchronous"
const FIELD_MODE_ASYNCHRONOUS = "mode_asynchronous"
const INTERSECTION_ROOT_MARGIN = "-40% 0px -45% 0px"
const SCROLL_BEHAVIOR = "smooth"
const SCROLL_BLOCK = "start"
const AUTOSAVE_DEBOUNCE_MS = 1500
const ROWS_STANDARD = 3
const ROWS_LONG = 5
const ROWS_SHORT = 2
const ICON_SIZE_SECTION = 14
const ICON_SIZE_NAV = 14
const ICON_SIZE_SECTION_BADGE = 18

// eslint-disable-next-line i18next/no-literal-string
const ANALYSIS_WORKSPACE_SCHEMA_V1 = "analysis_v1" as const

const LANGUAGE_OPTIONS = [
  { key: "en", value: "English" },
  { key: "fi", value: "Finnish" },
  { key: "sv", value: "Swedish" },
  { key: "no", value: "Norwegian" },
  { key: "da", value: "Danish" },
  { key: "de", value: "German" },
  { key: "fr", value: "French" },
  { key: "es", value: "Spanish" },
  { key: "it", value: "Italian" },
] as const
const SECTION_COUNT = 6
const SECTION_DOM_PREFIX = "analysis-section-"

type AnalysisSectionIndex = 1 | 2 | 3 | 4 | 5 | 6

/** Stable DOM id for the section heading (aria-labelledby). */
function analysisSectionHeadingId(n: AnalysisSectionIndex): string {
  // eslint-disable-next-line i18next/no-literal-string -- DOM id suffix, not user-facing
  return `${SECTION_DOM_PREFIX}${n}-heading`
}

/** Stable DOM id for the collapsible section body (aria-controls). */
function analysisSectionBodyId(n: AnalysisSectionIndex): string {
  // eslint-disable-next-line i18next/no-literal-string -- DOM id suffix, not user-facing
  return `${SECTION_DOM_PREFIX}${n}-body`
}

type AnalysisWorkspaceFormValues = Omit<AnalysisWorkspaceV1, "open_period_all">

function defaultAnalysisWorkspaceV1(): AnalysisWorkspaceV1 {
  return {
    course_title: null,
    credits: null,
    language: null,
    target_group: null,
    mode_synchronous: false,
    mode_asynchronous: false,
    open_period_i: false,
    open_period_ii: false,
    open_period_iii: false,
    open_period_iv: false,
    open_period_all: false,
    responsible_teachers: null,
    degree_programme: null,
    course_type: null,
    students_demographic_data: null,
    wishes_topics: null,
    wishes_content_format_text: false,
    wishes_content_format_video: false,
    wishes_content_format_podcast: false,
    wishes_content_format_xr: false,
    wishes_content_format_notes: null,
    wishes_assessment_text: null,
    wishes_other_suggestions: null,
    market_results: null,
    resources_university: null,
    resources_purchase_budget: null,
    contributors_instructional_designer: null,
    contributors_subject_matter_experts: null,
    contributors_editors: null,
    contributors_support_staff: null,
  }
}

function parseAnalysisWorkspaceFromApi(raw: unknown | null | undefined): AnalysisWorkspaceV1 {
  if (raw == null || typeof raw !== "object") {
    return defaultAnalysisWorkspaceV1()
  }
  const value = raw as { schema?: string; payload?: unknown }
  if (
    value.schema === ANALYSIS_WORKSPACE_SCHEMA_V1 &&
    value.payload != null &&
    typeof value.payload === "object"
  ) {
    return { ...defaultAnalysisWorkspaceV1(), ...(value.payload as AnalysisWorkspaceV1) }
  }
  return defaultAnalysisWorkspaceV1()
}

/** Drops `open_period_all` so it is not a registered field (derived on save). */
function stripOpenPeriodAll(v: AnalysisWorkspaceV1): AnalysisWorkspaceFormValues {
  const { open_period_all: _, ...rest } = v
  return rest
}

/** API payload includes `open_period_all`, derived from the four period flags. */
function withDerivedOpenPeriodAll(values: AnalysisWorkspaceFormValues): AnalysisWorkspaceV1 {
  return {
    ...values,
    open_period_all: Boolean(
      values.open_period_i &&
      values.open_period_ii &&
      values.open_period_iii &&
      values.open_period_iv,
    ),
  }
}

/** Maps credits text input to `number | null` and validates finiteness. */
function buildCreditsFieldRules(t: TFunction) {
  return {
    setValueAs: stringToNumberOrNull,
    validate: (v: unknown) =>
      v == null ||
      (typeof v === "number" && Number.isFinite(v)) ||
      t("course-plans-analysis-error-credits-invalid"),
  }
}

function isFilled(v: unknown): boolean {
  if (v == null) {
    return false
  }
  if (typeof v === "boolean") {
    return v
  }
  if (typeof v === "string") {
    return v.trim() !== ""
  }
  if (typeof v === "number") {
    return Number.isFinite(v)
  }
  return false
}

function computeSectionCompletion(v: AnalysisWorkspaceFormValues): boolean[] {
  const s1 =
    isFilled(v.course_title) ||
    v.credits != null ||
    isFilled(v.language) ||
    isFilled(v.target_group) ||
    v.mode_synchronous ||
    v.mode_asynchronous ||
    v.open_period_i ||
    v.open_period_ii ||
    v.open_period_iii ||
    v.open_period_iv ||
    isFilled(v.responsible_teachers) ||
    isFilled(v.degree_programme) ||
    v.course_type != null
  const s2 = isFilled(v.students_demographic_data)
  const s3 =
    isFilled(v.wishes_topics) ||
    v.wishes_content_format_text ||
    v.wishes_content_format_video ||
    v.wishes_content_format_podcast ||
    v.wishes_content_format_xr ||
    isFilled(v.wishes_content_format_notes) ||
    isFilled(v.wishes_assessment_text) ||
    isFilled(v.wishes_other_suggestions)
  const s4 = isFilled(v.market_results)
  const s5 = isFilled(v.resources_university) || isFilled(v.resources_purchase_budget)
  const s6 =
    isFilled(v.contributors_instructional_designer) ||
    isFilled(v.contributors_subject_matter_experts) ||
    isFilled(v.contributors_editors) ||
    isFilled(v.contributors_support_staff)
  return [s1, s2, s3, s4, s5, s6]
}

const formRootStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const stickyMergedBarStyles = css`
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0;
  margin: 0 0 0.5rem 0;
  background: ${baseTheme.colors.clear[100]};
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

const stickyBarRow1Styles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  width: 100%;
`

const statusLeftStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
  min-width: 0;
`

const progressSummaryStyles = css`
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
  white-space: nowrap;
`

const saveStatusStyles = css`
  font-size: 0.875rem;
  color: ${baseTheme.colors.gray[600]};
  min-height: 1.25rem;
`

const saveStatusErrorStyles = css`
  color: ${baseTheme.colors.crimson[700]};
`

const saveHintStyles = css`
  font-size: 0.75rem;
  color: ${baseTheme.colors.gray[500]};
  max-width: 12rem;
  line-height: 1.35;
`

const saveRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const stickyNavRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  padding-top: 0.35rem;
  border-top: 1px solid ${baseTheme.colors.gray[100]};
  width: 100%;
`

const sectionNavLinkStyles = css`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: ${baseTheme.colors.green[700]};
  text-decoration: none;
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;

  &:hover {
    text-decoration: underline;
  }
`

const sectionNavLinkActiveStyles = css`
  font-weight: 700;
  background: ${baseTheme.colors.gray[100]};
`

const navIncompleteDotStyles = css`
  display: inline-block;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: ${baseTheme.colors.gray[300]};
  flex-shrink: 0;
`

const sectionCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
`

const sectionAccentByIndex = [
  css`
    border-left: 4px solid ${baseTheme.colors.green[600]};
  `,
  css`
    border-left: 4px solid ${baseTheme.colors.green[500]};
  `,
  css`
    border-left: 4px solid ${baseTheme.colors.blue[600]};
  `,
  css`
    border-left: 4px solid ${baseTheme.colors.blue[500]};
  `,
  css`
    border-left: 4px solid ${baseTheme.colors.purple[600]};
  `,
  css`
    border-left: 4px solid ${baseTheme.colors.green[800]};
  `,
]

const sectionHeaderRowStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`

const sectionToggleStyles = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  padding: 0.25rem 0.35rem;
  margin-left: -0.35rem;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: ${baseTheme.colors.gray[900]};
  border-radius: 0.35rem;

  &:hover {
    background: ${baseTheme.colors.gray[100]};
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
`

const sectionChevronStyles = (expanded: boolean) => css`
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
  color: ${baseTheme.colors.gray[500]};
  transform: rotate(${expanded ? "180deg" : "0deg"});
  transition: transform 0.15s ease;
`

const sectionBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
`

const sectionTitleStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const sectionHeaderIconWrapStyles = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.375rem;
  background: ${baseTheme.colors.green[50]};
  color: ${baseTheme.colors.green[700]};
`

const subsectionTitleStyles = css`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.25rem 0 0 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

const staticTextStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.55;
  margin: 0;
  white-space: pre-line;
`

const checkboxGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
`

const checkboxRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4, 1rem);
`

const openPeriodAllRowStyles = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  cursor: pointer;
`

const contributorsListStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const contributorCardStyles = css`
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.clear[50]};
  padding: 1rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`

const contributorCardLeadStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
`

const contributorCardTitleStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.35rem 0;
  line-height: 1.35;
`

const contributorDutiesStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  line-height: 1.5;
`

const roleBlockStyles = css`
  margin: 0;
  padding: 0;
  border: 0;
`

const twoColGridStyles = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;

  ${respondToOrLarger.md} {
    grid-template-columns: 1fr 1fr;
  }
`

const modeAndPeriodsRowStyles = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;

  ${respondToOrLarger.lg} {
    grid-template-columns: 1fr 1fr;
  }
`

const uhCalloutStyles = css`
  margin-top: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.blue[200]};
  background: ${baseTheme.colors.blue[25]};
  padding: 0.85rem 1rem;
`

const uhCalloutTitleStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
`

const uhLineStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.35rem 0;
  line-height: 1.5;
`

const uhLinkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
  word-break: break-all;
`

type ContributorFieldKey = keyof Pick<
  AnalysisWorkspaceV1,
  | "contributors_instructional_designer"
  | "contributors_subject_matter_experts"
  | "contributors_editors"
  | "contributors_support_staff"
>

const SECTION_NAV_KEYS = [
  "course-plans-analysis-section-1",
  "course-plans-analysis-section-2",
  "course-plans-analysis-section-3",
  "course-plans-analysis-section-4",
  "course-plans-analysis-section-5",
  "course-plans-analysis-section-6",
] as const

const SECTION_HEADER_ICONS = [
  Document,
  Users,
  Pencil,
  Statistics,
  Coins,
  AccountsGroupPeople,
] as const

/**
 * Collapsible section title row: expand chevron, thematic Atlas icon, and heading text.
 */
function SectionCollapsibleHeader(props: {
  sectionNum: AnalysisSectionIndex
  expanded: boolean
  onToggle: () => void
  title: ReactNode
}) {
  const { sectionNum, expanded, onToggle, title } = props
  const Icon = SECTION_HEADER_ICONS[sectionNum - 1]
  const headingId = analysisSectionHeadingId(sectionNum)
  const bodyControlsId = analysisSectionBodyId(sectionNum)
  return (
    <div className={sectionHeaderRowStyles}>
      <button
        type="button"
        className={sectionToggleStyles}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={bodyControlsId}
      >
        <span className={sectionChevronStyles(expanded)} aria-hidden>
          <ArrowDown size={ICON_SIZE_SECTION} />
        </span>
        <span className={sectionHeaderIconWrapStyles} aria-hidden>
          <Icon size={ICON_SIZE_SECTION_BADGE} />
        </span>
        <span className={sectionTitleStyles} id={headingId}>
          {title}
        </span>
      </button>
    </div>
  )
}

const CONTENT_FORMAT_FIELDS = [
  ["wishes_content_format_text", "course-plans-analysis-format-text"],
  ["wishes_content_format_video", "course-plans-analysis-format-video"],
  ["wishes_content_format_podcast", "course-plans-analysis-format-podcast"],
  ["wishes_content_format_xr", "course-plans-analysis-format-xr"],
] as const

const CONTRIBUTOR_ROLES = [
  {
    dutiesKey: "course-plans-analysis-role-instructional-designer-duties",
    field: "contributors_instructional_designer",
    nameKey: "course-plans-analysis-role-instructional-designer",
  },
  {
    dutiesKey: "course-plans-analysis-role-sme-duties",
    field: "contributors_subject_matter_experts",
    nameKey: "course-plans-analysis-role-sme",
  },
  {
    dutiesKey: "course-plans-analysis-role-editors-duties",
    field: "contributors_editors",
    nameKey: "course-plans-analysis-role-editors",
  },
  {
    dutiesKey: "course-plans-analysis-role-support-duties",
    field: "contributors_support_staff",
    nameKey: "course-plans-analysis-role-support",
  },
] as const satisfies ReadonlyArray<{
  dutiesKey: string
  field: ContributorFieldKey
  nameKey: string
}>

/**
 * Renders a line of localized resource text with mailto and https links activated.
 */
function linkifyResourceLine(line: string): ReactNode {
  const re = /(https?:\/\/[^\s]+)|([\w.+-]+@[\w.-]+\.[a-z]{2,})/gi
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(line)) !== null) {
    if (match.index > last) {
      parts.push(line.slice(last, match.index))
    }
    const url = match[1]
    const email = match[2]
    const href = url ?? `${MAILTO_PREFIX}${email}`
    const label = match[0]
    parts.push(
      <a
        key={`${match.index}-${label}`}
        href={href}
        className={uhLinkStyles}
        {...(url ? { target: EXTERNAL_LINK_TARGET, rel: EXTERNAL_LINK_REL } : {})}
      >
        {label}
      </a>,
    )
    last = match.index + match[0].length
  }
  if (last < line.length) {
    parts.push(line.slice(last))
  }
  return parts.length > 0 ? parts : line
}

/**
 * One key contributor role: title, duties, then full-width assignees field.
 */
function ContributorRoleBlock(props: {
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

/**
 * Checkbox groups for mode and content-format preferences.
 */
function ModeCheckboxRow(props: { control: Control<AnalysisWorkspaceFormValues>; t: TFunction }) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>{t("course-plans-analysis-field-mode")}</legend>
      <div className={checkboxRowStyles}>
        <Checkbox
          name={FIELD_MODE_SYNCHRONOUS}
          control={control}
          label={t("course-plans-analysis-mode-synchronous")}
        />
        <Checkbox
          name={FIELD_MODE_ASYNCHRONOUS}
          control={control}
          label={t("course-plans-analysis-mode-asynchronous")}
        />
      </div>
    </fieldset>
  )
}

/**
 * Open-period checkboxes; "All" is derived from the four periods and toggles them via `setValue` (not an RHF field).
 */
function OpenPeriodCheckboxes(props: {
  control: Control<AnalysisWorkspaceFormValues>
  setValue: UseFormSetValue<AnalysisWorkspaceFormValues>
  t: TFunction
}) {
  const { control, setValue, t } = props

  const [p1, p2, p3, p4] = useWatch({
    control,
    name: [OPEN_PERIOD_I, OPEN_PERIOD_II, OPEN_PERIOD_III, OPEN_PERIOD_IV],
  })
  const allSelected = Boolean(p1 && p2 && p3 && p4)

  const handleToggleAll = () => {
    const next = !allSelected
    setValue(OPEN_PERIOD_I, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_II, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_III, next, { shouldDirty: true })
    setValue(OPEN_PERIOD_IV, next, { shouldDirty: true })
  }

  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-open-periods")}
      </legend>
      <div className={checkboxGroupStyles}>
        <div className={checkboxRowStyles}>
          <label className={openPeriodAllRowStyles}>
            <input type="checkbox" checked={allSelected} onChange={handleToggleAll} />
            {t("course-plans-analysis-period-all")}
          </label>
          <Checkbox
            name={OPEN_PERIOD_I}
            control={control}
            label={t("course-plans-analysis-period-i")}
          />
          <Checkbox
            name={OPEN_PERIOD_II}
            control={control}
            label={t("course-plans-analysis-period-ii")}
          />
          <Checkbox
            name={OPEN_PERIOD_III}
            control={control}
            label={t("course-plans-analysis-period-iii")}
          />
          <Checkbox
            name={OPEN_PERIOD_IV}
            control={control}
            label={t("course-plans-analysis-period-iv")}
          />
        </div>
      </div>
    </fieldset>
  )
}

/**
 * Content format checkboxes.
 */
function ContentFormatCheckboxes(props: {
  control: Control<AnalysisWorkspaceFormValues>
  t: TFunction
}) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-content-format")}
      </legend>
      <div className={checkboxRowStyles}>
        {CONTENT_FORMAT_FIELDS.map(([name, labelKey]) => (
          <Checkbox key={name} name={name} control={control} label={t(labelKey)} />
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Loads and persists the Analysis stage workspace (v1) using react-hook-form.
 */
export default function AnalysisWorkspaceForm(props: {
  onDirtyChange?: (dirty: boolean) => void
  planId: string
  workspaceData: unknown | null
}) {
  const { onDirtyChange, planId, workspaceData } = props
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>(() => {
    return Object.fromEntries(
      Array.from({ length: SECTION_COUNT }, (_, i) => [i + 1, true] as const),
    ) as Record<number, boolean>
  })
  const [activeSection, setActiveSection] = useState(1)
  const [autosaveError, setAutosaveError] = useState(false)
  const [showSavedStatus, setShowSavedStatus] = useState(false)
  const isDirtyRef = useRef(false)

  const form = useForm<AnalysisWorkspaceFormValues>({
    defaultValues: stripOpenPeriodAll(defaultAnalysisWorkspaceV1()),
  })

  const { control, handleSubmit, reset, setValue, getValues, watch, trigger } = form
  const { isDirty } = useFormState({ control })
  const creditsFieldRules = useMemo(() => buildCreditsFieldRules(t), [t])
  const languageWatch = useWatch({ control, name: FIELD_LANGUAGE })

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (isDirty) {
      setShowSavedStatus(false)
    }
  }, [isDirty])

  useEffect(() => {
    reset(stripOpenPeriodAll(parseAnalysisWorkspaceFromApi(workspaceData)))
  }, [workspaceData, reset])

  const patchWorkspace = useCallback(
    (payload: AnalysisWorkspaceV1) => ({
      body: {
        schema: ANALYSIS_WORKSPACE_SCHEMA_V1,
        payload,
      },
      path: {
        plan_id: planId,
        stage: STAGE_ANALYSIS.toLowerCase(),
      },
    }),
    [planId],
  )

  const handleSaveSuccess = useCallback(
    async (saved: AnalysisWorkspaceV1) => {
      reset(stripOpenPeriodAll(saved))
      setAutosaveError(false)
      setShowSavedStatus(true)
      await queryClient.invalidateQueries({
        queryKey: getCourseDesignerPlanQueryKey({ path: { plan_id: planId } }),
      })
      onDirtyChange?.(false)
    },
    [onDirtyChange, planId, queryClient, reset],
  )

  const autosaveMutation = useToastMutationOptions(
    updateCourseDesignerStageWorkspaceMutation(),
    { notify: false },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables.body.payload)
      },
      onError: () => {
        setAutosaveError(true)
      },
    },
  )

  const manualSaveMutation = useToastMutationOptions(
    updateCourseDesignerStageWorkspaceMutation(),
    {
      notify: true,
      method: "PATCH",
      loadingText: t("course-plans-analysis-saving"),
    },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables.body.payload)
      },
    },
  )

  const formValues = watch()

  const sectionCompletionFlags = useMemo(() => computeSectionCompletion(formValues), [formValues])

  const sectionsWithContentCount = useMemo(
    () => sectionCompletionFlags.filter(Boolean).length,
    [sectionCompletionFlags],
  )

  const debouncedAutosave = useDebouncedCallback(async () => {
    if (!isDirtyRef.current) {
      return
    }
    const ok = await trigger()
    if (!ok) {
      setAutosaveError(true)
      return
    }
    setAutosaveError(false)
    autosaveMutation.mutate(patchWorkspace(withDerivedOpenPeriodAll(getValues())))
  }, AUTOSAVE_DEBOUNCE_MS)

  useEffect(() => {
    const subscription = watch(() => {
      debouncedAutosave()
    })
    return () => subscription.unsubscribe()
  }, [watch, debouncedAutosave])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  useEffect(() => {
    const ids = [1, 2, 3, 4, 5, 6]
    const elements = ids
      .map((id) => document.getElementById(`${SECTION_DOM_PREFIX}${id}`))
      .filter((el): el is HTMLElement => el != null)
    if (elements.length === 0) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((en) => en.isIntersecting)
        if (intersecting.length === 0) {
          return
        }
        intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = intersecting[0].target.id
        const n = Number.parseInt(id.replace(SECTION_DOM_PREFIX, ""), 10)
        if (!Number.isNaN(n)) {
          setActiveSection(n)
        }
      },
      {
        root: null,
        rootMargin: INTERSECTION_ROOT_MARGIN,
        threshold: 0,
      },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [expandedSections])

  const onSubmit = (data: AnalysisWorkspaceFormValues) => {
    manualSaveMutation.mutate(patchWorkspace(withDerivedOpenPeriodAll(data)))
  }

  const saving = autosaveMutation.isPending || manualSaveMutation.isPending

  const statusText = useMemo(() => {
    if (saving) {
      return t("course-plans-analysis-save-status-saving")
    }
    if (autosaveError) {
      return t("course-plans-analysis-save-status-error")
    }
    if (isDirty) {
      return t("course-plans-analysis-save-status-unsaved")
    }
    if (showSavedStatus) {
      return t("course-plans-analysis-save-status-saved")
    }
    return t("course-plans-analysis-save-status-idle")
  }, [autosaveError, isDirty, saving, showSavedStatus, t])

  const scrollToSection = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({
      behavior: SCROLL_BEHAVIOR,
      block: SCROLL_BLOCK,
    })
  }

  const toggleSection = (n: number) => {
    setExpandedSections((prev) => ({ ...prev, [n]: !prev[n] }))
  }

  const uhBody = t("course-plans-analysis-resources-uh-body")
  const uhLines = uhBody.split("\n").filter((line) => line.trim() !== "")

  const showUhResources =
    typeof process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES === "undefined" ||
    process.env.NEXT_PUBLIC_SHOW_UH_ANALYSIS_RESOURCES !== "false"

  return (
    <form className={formRootStyles} onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className={stickyMergedBarStyles}>
        <div className={stickyBarRow1Styles}>
          <div className={statusLeftStyles}>
            <div
              className={cx(saveStatusStyles, autosaveError && saveStatusErrorStyles)}
              role="status"
              aria-live="polite"
            >
              {statusText}
            </div>
            <span className={progressSummaryStyles}>
              {t("course-plans-analysis-sections-progress", {
                started: sectionsWithContentCount,
                total: SECTION_COUNT,
              })}
            </span>
          </div>
          <div className={saveRowStyles}>
            <span className={saveHintStyles}>{t("course-plans-analysis-autosave-hint")}</span>
            <Button
              type="submit"
              variant="primary"
              size="medium"
              disabled={saving}
              aria-label={t("course-plans-analysis-sticky-save-aria")}
            >
              {saving ? t("course-plans-analysis-saving") : t("course-plans-analysis-save-now")}
            </Button>
          </div>
        </div>
        <nav className={stickyNavRowStyles} aria-label={t("course-plans-analysis-nav-aria-label")}>
          {SECTION_NAV_KEYS.map((key, index) => {
            const n = index + 1
            const sectionId = `${SECTION_DOM_PREFIX}${n}`
            const complete = sectionCompletionFlags[index] === true
            return (
              <a
                key={sectionId}
                href={`#${sectionId}`}
                className={cx(
                  sectionNavLinkStyles,
                  activeSection === n && sectionNavLinkActiveStyles,
                )}
                onClick={scrollToSection(sectionId)}
              >
                {complete ? (
                  <CheckCircle size={ICON_SIZE_NAV} aria-hidden />
                ) : (
                  <span className={navIncompleteDotStyles} aria-hidden />
                )}
                {t(key)}
              </a>
            )
          })}
        </nav>
      </div>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[0])}
        id={`${SECTION_DOM_PREFIX}1`}
        aria-labelledby={analysisSectionHeadingId(1)}
      >
        <SectionCollapsibleHeader
          sectionNum={1}
          expanded={expandedSections[1] !== false}
          onToggle={() => toggleSection(1)}
          title={t("course-plans-analysis-section-1")}
        />
        {expandedSections[1] !== false ? (
          <div id={analysisSectionBodyId(1)} className={sectionBodyStyles}>
            <h3 className={subsectionTitleStyles}>{t("course-plans-analysis-subgroup-basic")}</h3>
            <TextField
              // eslint-disable-next-line i18next/no-literal-string
              name="course_title"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-course-title")}
              description={t("course-plans-analysis-description-course-title")}
            />
            <div className={twoColGridStyles}>
              <TextField
                name={FIELD_CREDITS}
                control={control}
                rules={creditsFieldRules}
                label={t("course-plans-analysis-field-credits")}
                description={t("course-plans-analysis-description-credits")}
                inputMode={INPUT_MODE_DECIMAL}
                autoComplete="off"
              />
              <ComboBox
                name={FIELD_LANGUAGE}
                control={control}
                getItemKey={(item) => item.value}
                getItemTextValue={(item) => t(`course-plans-analysis-lang-${item.key}`)}
                label={t("course-plans-analysis-field-language")}
                description={t("course-plans-analysis-description-language")}
                items={LANGUAGE_OPTIONS}
                allowsCustomValue
                placeholder={t("course-plans-analysis-language-placeholder")}
                inputValue={languageWatch ?? ""}
                onInputChange={(raw) => {
                  setValue(FIELD_LANGUAGE, emptyStringToNull(raw), { shouldDirty: true })
                }}
              >
                {(item) => t(`course-plans-analysis-lang-${item.key}`)}
              </ComboBox>
            </div>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="target_group"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-target-group")}
              description={t("course-plans-analysis-description-target-group")}
              rows={ROWS_SHORT}
            />
            <h3 className={subsectionTitleStyles}>
              {t("course-plans-analysis-subgroup-logistics")}
            </h3>
            <div className={modeAndPeriodsRowStyles}>
              <ModeCheckboxRow control={control} t={t} />
              <OpenPeriodCheckboxes control={control} setValue={setValue} t={t} />
            </div>
            <h3 className={subsectionTitleStyles}>
              {t("course-plans-analysis-subgroup-organizational")}
            </h3>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="responsible_teachers"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-teachers-in-charge")}
              description={t("course-plans-analysis-description-teachers-in-charge")}
              rows={ROWS_SHORT}
            />
            <div className={twoColGridStyles}>
              <TextField
                // eslint-disable-next-line i18next/no-literal-string
                name="degree_programme"
                control={control}
                rules={nullIfEmpty}
                label={t("course-plans-analysis-field-degree-programme")}
                description={t("course-plans-analysis-description-degree-programme")}
              />
              <Select
                name={FIELD_COURSE_TYPE}
                control={control}
                rules={{
                  setValueAs: (v: unknown) =>
                    v === "" || v == null ? null : (v as AnalysisCourseType),
                }}
                label={t("course-plans-analysis-field-course-type")}
                options={[
                  {
                    value: "",
                    label: t("course-plans-analysis-course-type-none"),
                  },
                  {
                    // eslint-disable-next-line i18next/no-literal-string -- backend enum value
                    value: "compulsory",
                    label: t("course-plans-analysis-course-type-compulsory"),
                  },
                  {
                    // eslint-disable-next-line i18next/no-literal-string -- backend enum value
                    value: "elective",
                    label: t("course-plans-analysis-course-type-elective"),
                  },
                ]}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[1])}
        id={`${SECTION_DOM_PREFIX}2`}
        aria-labelledby={analysisSectionHeadingId(2)}
      >
        <SectionCollapsibleHeader
          sectionNum={2}
          expanded={expandedSections[2] !== false}
          onToggle={() => toggleSection(2)}
          title={t("course-plans-analysis-section-2")}
        />
        {expandedSections[2] !== false ? (
          <div id={analysisSectionBodyId(2)} className={sectionBodyStyles}>
            <p className={staticTextStyles}>{t("course-plans-analysis-students-needs-intro")}</p>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="students_demographic_data"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-students-demographic")}
              description={t("course-plans-analysis-description-students-demographic")}
              rows={ROWS_LONG}
            />
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[2])}
        id={`${SECTION_DOM_PREFIX}3`}
        aria-labelledby={analysisSectionHeadingId(3)}
      >
        <SectionCollapsibleHeader
          sectionNum={3}
          expanded={expandedSections[3] !== false}
          onToggle={() => toggleSection(3)}
          title={t("course-plans-analysis-section-3")}
        />
        {expandedSections[3] !== false ? (
          <div id={analysisSectionBodyId(3)} className={sectionBodyStyles}>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="wishes_topics"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-wishes-topics")}
              placeholder={t("course-plans-analysis-placeholder-wishes-topics")}
              rows={ROWS_STANDARD}
            />
            <ContentFormatCheckboxes control={control} t={t} />
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="wishes_content_format_notes"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-content-format-notes")}
              placeholder={t("course-plans-analysis-placeholder-content-format-notes")}
              rows={ROWS_STANDARD}
            />
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="wishes_assessment_text"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-assessment")}
              placeholder={t("course-plans-analysis-placeholder-assessment")}
              rows={ROWS_STANDARD}
            />
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="wishes_other_suggestions"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-wishes-other")}
              placeholder={t("course-plans-analysis-placeholder-wishes-other")}
              rows={ROWS_STANDARD}
            />
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[3])}
        id={`${SECTION_DOM_PREFIX}4`}
        aria-labelledby={analysisSectionHeadingId(4)}
      >
        <SectionCollapsibleHeader
          sectionNum={4}
          expanded={expandedSections[4] !== false}
          onToggle={() => toggleSection(4)}
          title={t("course-plans-analysis-section-4")}
        />
        {expandedSections[4] !== false ? (
          <div id={analysisSectionBodyId(4)} className={sectionBodyStyles}>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="market_results"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-market-results")}
              description={t("course-plans-analysis-description-market-results")}
              rows={ROWS_LONG}
            />
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[4])}
        id={`${SECTION_DOM_PREFIX}5`}
        aria-labelledby={analysisSectionHeadingId(5)}
      >
        <SectionCollapsibleHeader
          sectionNum={5}
          expanded={expandedSections[5] !== false}
          onToggle={() => toggleSection(5)}
          title={t("course-plans-analysis-section-5")}
        />
        {expandedSections[5] !== false ? (
          <div id={analysisSectionBodyId(5)} className={sectionBodyStyles}>
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="resources_university"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-resources-university")}
              placeholder={t("course-plans-analysis-placeholder-resources-university")}
              rows={ROWS_STANDARD}
            />
            <TextArea
              // eslint-disable-next-line i18next/no-literal-string
              name="resources_purchase_budget"
              control={control}
              rules={nullIfEmpty}
              label={t("course-plans-analysis-field-resources-purchase")}
              placeholder={t("course-plans-analysis-placeholder-resources-purchase")}
              rows={ROWS_STANDARD}
            />
            {showUhResources ? (
              <div className={uhCalloutStyles}>
                <p className={uhCalloutTitleStyles}>
                  {t("course-plans-analysis-resources-uh-heading")}
                </p>
                {uhLines.map((line, index) => (
                  <p key={`uh-line-${index}`} className={uhLineStyles}>
                    {linkifyResourceLine(line)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className={cx(sectionCardStyles, sectionAccentByIndex[5])}
        id={`${SECTION_DOM_PREFIX}6`}
        aria-labelledby={analysisSectionHeadingId(6)}
      >
        <SectionCollapsibleHeader
          sectionNum={6}
          expanded={expandedSections[6] !== false}
          onToggle={() => toggleSection(6)}
          title={t("course-plans-analysis-section-6")}
        />
        {expandedSections[6] !== false ? (
          <div id={analysisSectionBodyId(6)} className={sectionBodyStyles}>
            <p className={staticTextStyles}>{t("course-plans-analysis-contributors-intro")}</p>
            <div className={contributorsListStyles}>
              {CONTRIBUTOR_ROLES.map((role) => (
                <ContributorRoleBlock
                  key={role.field}
                  control={control}
                  field={role.field}
                  nameKey={role.nameKey}
                  dutiesKey={role.dutiesKey}
                  t={t}
                />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </form>
  )
}
