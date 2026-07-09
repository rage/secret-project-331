import { css } from "@emotion/css"
import {
  AccountsGroupPeople,
  Coins,
  Document,
  Filter,
  Pencil,
  Statistics,
  Users,
} from "@vectopus/atlas-icons-react"
import type { TFunction } from "i18next"
import { createElement, type ReactNode } from "react"

import type { AnalysisWorkspaceV1, CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { stringToNumberOrNull } from "@/shared-module/components"

export const STAGE_ANALYSIS: CourseDesignerStage = "Analysis"
export const FIELD_CREDITS = "credits"
export const FIELD_LANGUAGE = "language"
export const FIELD_COURSE_TYPE = "course_type"
export const INPUT_MODE_DECIMAL = "decimal"
export const MAILTO_PREFIX = "mailto:"
export const EXTERNAL_LINK_TARGET = "_blank"
export const EXTERNAL_LINK_REL = "noopener noreferrer"
export const OPEN_PERIOD_I = "open_period_i"
export const OPEN_PERIOD_II = "open_period_ii"
export const OPEN_PERIOD_III = "open_period_iii"
export const OPEN_PERIOD_IV = "open_period_iv"
export const FIELD_MODE_SYNCHRONOUS = "mode_synchronous"
export const FIELD_MODE_ASYNCHRONOUS = "mode_asynchronous"
export const INTERSECTION_ROOT_MARGIN = "-40% 0px -45% 0px"
export const SCROLL_BEHAVIOR = "smooth"
export const SCROLL_BLOCK = "start"
export const AUTOSAVE_DEBOUNCE_MS = 1500
export const ROWS_STANDARD = 3
export const ROWS_LONG = 5
export const ROWS_SHORT = 2
export const ICON_SIZE_SECTION = 14
export const ICON_SIZE_SECTION_BADGE = 18

export const ANALYSIS_WORKSPACE_SCHEMA_V1 = "analysis_v1" as const

export const LANGUAGE_OPTIONS = [
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
export const SECTION_COUNT = 6
export const SECTION_DOM_PREFIX = "analysis-section-"

export type AnalysisSectionIndex = 1 | 2 | 3 | 4 | 5 | 6

export type AnalysisWorkspaceFormValues = Omit<AnalysisWorkspaceV1, "open_period_all">

export type ContributorFieldKey = keyof Pick<
  AnalysisWorkspaceV1,
  | "contributors_instructional_designer"
  | "contributors_subject_matter_experts"
  | "contributors_editors"
  | "contributors_support_staff"
>

/** Stable DOM id for the section heading (aria-labelledby). */
export function analysisSectionHeadingId(n: AnalysisSectionIndex): string {
  return `${SECTION_DOM_PREFIX}${n}-heading`
}

/** Stable DOM id for the collapsible section body (aria-controls). */
export function analysisSectionBodyId(n: AnalysisSectionIndex): string {
  return `${SECTION_DOM_PREFIX}${n}-body`
}

/** Default empty Analysis workspace v1 payload. */
export function defaultAnalysisWorkspaceV1(): AnalysisWorkspaceV1 {
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

/** Parses API workspace blob into AnalysisWorkspaceV1. */
export function parseAnalysisWorkspaceFromApi(
  raw: unknown | null | undefined,
): AnalysisWorkspaceV1 {
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
export function stripOpenPeriodAll(v: AnalysisWorkspaceV1): AnalysisWorkspaceFormValues {
  const { open_period_all: _, ...rest } = v
  return rest
}

/** API payload includes `open_period_all`, derived from the four period flags. */
export function withDerivedOpenPeriodAll(values: AnalysisWorkspaceFormValues): AnalysisWorkspaceV1 {
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
export function buildCreditsFieldRules(t: TFunction) {
  return {
    setValueAs: stringToNumberOrNull,
    validate: (v: unknown) =>
      v == null ||
      (typeof v === "number" && Number.isFinite(v)) ||
      t("course-plans-analysis-error-credits-invalid"),
  }
}

export const SECTION_NAV_KEYS = [
  "course-plans-analysis-section-1",
  "course-plans-analysis-section-2",
  "course-plans-analysis-section-3",
  "course-plans-analysis-section-4",
  "course-plans-analysis-section-5",
  "course-plans-analysis-section-6",
] as const

export const SECTION_HEADER_ICONS = [
  Filter,
  Document,
  Users,
  Pencil,
  Statistics,
  Coins,
  AccountsGroupPeople,
] as const

export const CourseFilterIcon = Filter

export const CONTENT_FORMAT_FIELDS = [
  ["wishes_content_format_text", "course-plans-analysis-format-text"],
  ["wishes_content_format_video", "course-plans-analysis-format-video"],
  ["wishes_content_format_podcast", "course-plans-analysis-format-podcast"],
  ["wishes_content_format_xr", "course-plans-analysis-format-xr"],
] as const

export const CONTRIBUTOR_ROLES = [
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
export function linkifyResourceLine(line: string): ReactNode {
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
      createElement(
        "a",
        {
          key: `${match.index}-${label}`,
          href,
          className: uhLinkStyles,
          ...(url ? { target: EXTERNAL_LINK_TARGET, rel: EXTERNAL_LINK_REL } : {}),
        },
        label,
      ),
    )
    last = match.index + match[0].length
  }
  if (last < line.length) {
    parts.push(line.slice(last))
  }
  return parts.length > 0 ? parts : line
}

export const formRootStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

export const stickyToolbarStyles = css`
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 0.9rem 1rem 1rem;
  margin: 0 0 0.5rem 0;
  background: ${baseTheme.colors.clear[100]};
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};

  ${respondToOrLarger.md} {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }

  ${respondToOrLarger.lg} {
    padding-left: 1.75rem;
    padding-right: 1.75rem;
  }
`

export const toolbarRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 2rem;
  width: 100%;
`

export const stickyNavStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.1rem;
  flex: 1 1 auto;
  min-width: 0;
`

export const sectionNavLinkStyles = css`
  display: inline-flex;
  align-items: center;
  font-size: 0.85rem;
  font-weight: 500;
  color: ${baseTheme.colors.gray[700]};
  text-decoration: none;
  padding: 0.35rem 0.1rem;
  border-bottom: 2px solid transparent;

  &:hover {
    color: ${baseTheme.colors.gray[900]};
    border-bottom-color: ${baseTheme.colors.gray[300]};
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[500]};
    outline-offset: 2px;
    border-radius: 0.2rem;
  }
`

export const sectionNavLinkActiveStyles = css`
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  border-bottom-color: ${baseTheme.colors.green[600]};
`

export const sectionCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
`

export const sectionAccentByIndex = [
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

export const sectionHeaderRowStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`

export const sectionToggleStyles = css`
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

export const sectionChevronStyles = (expanded: boolean) => css`
  display: inline-flex;
  flex-shrink: 0;
  line-height: 0;
  color: ${baseTheme.colors.gray[500]};
  transform: rotate(${expanded ? "180deg" : "0deg"});
  transition: transform 0.15s ease;
`

export const sectionBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
`

export const sectionTitleStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

export const sectionHeaderIconWrapStyles = css`
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

export const subsectionTitleStyles = css`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.25rem 0 0 0;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

export const staticTextStyles = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.gray[600]};
  line-height: 1.55;
  margin: 0;
  white-space: pre-line;
`

export const checkboxGroupStyles = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
`

export const checkboxRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4, 1rem);
  margin-top: 1rem;
`

export const openPeriodAllRowStyles = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  cursor: pointer;
`

export const contributorsListStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

export const contributorCardStyles = css`
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.clear[50]};
  padding: 1rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`

export const contributorCardLeadStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
`

export const contributorCardTitleStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0 0 0.35rem 0;
  line-height: 1.35;
`

export const contributorDutiesStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0;
  line-height: 1.5;
`

export const roleBlockStyles = css`
  margin: 0;
  padding: 0;
  border: 0;
`

export const twoColGridStyles = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;

  ${respondToOrLarger.md} {
    grid-template-columns: 1fr 1fr;
  }
`

export const modeAndPeriodsRowStyles = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;

  ${respondToOrLarger.lg} {
    grid-template-columns: 1fr 1fr;
  }
`

export const uhCalloutStyles = css`
  margin-top: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.blue[200]};
  background: ${baseTheme.colors.blue[25]};
  padding: 0.85rem 1rem;
`

export const uhCalloutTitleStyles = css`
  font-size: 0.9rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0 0 0.5rem 0;
`

export const uhLineStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[700]};
  margin: 0.35rem 0;
  line-height: 1.5;
`

export const uhLinkStyles = css`
  color: ${baseTheme.colors.green[700]};
  text-decoration: underline;
  word-break: break-all;
`
