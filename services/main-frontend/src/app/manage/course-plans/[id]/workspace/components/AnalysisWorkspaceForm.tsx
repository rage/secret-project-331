"use client"

import { css, cx } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Control, UseFormRegister } from "react-hook-form"
import { Controller, useForm, useFormState, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { useDebouncedCallback } from "use-debounce"

import { coursePlanQueryKeys } from "../../../coursePlanQueryKeys"

import {
  ANALYSIS_WORKSPACE_SCHEMA_V1,
  type AnalysisCourseType,
  type AnalysisWorkspaceV1,
  type CourseDesignerStage,
  defaultAnalysisWorkspaceV1,
  parseAnalysisWorkspaceFromApi,
  patchCourseDesignerStageWorkspace,
} from "@/services/backend/courseDesigner"
import Button from "@/shared-module/common/components/Button"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { Checkbox, Radio, RadioGroup, TextArea, TextField } from "@/shared-module/components"

const STAGE_ANALYSIS: CourseDesignerStage = "Analysis"
const FIELD_CREDITS = "credits"
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
const FIELD_OPEN_PERIOD_ALL = "open_period_all"
const INTERSECTION_ROOT_MARGIN = "-40% 0px -45% 0px"
const SCROLL_BEHAVIOR = "smooth"
const SCROLL_BLOCK = "start"
const SECTION_TOGGLE_CHEVRON = "\u25bc"
const AUTOSAVE_DEBOUNCE_MS = 1500
const ROWS_STANDARD = 3
const ROWS_LONG = 5
const SECTION_COUNT = 6
const SECTION_DOM_PREFIX = "analysis-section-"

const nullIfEmpty = { setValueAs: (v: string) => (v === "" ? null : v) }

const formRootStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const stickyToolbarStyles = css`
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
  margin: 0 0 0.25rem 0;
  background: ${baseTheme.colors.clear[100]};
  border-bottom: 1px solid ${baseTheme.colors.gray[200]};
`

const saveStatusStyles = css`
  font-size: 0.875rem;
  color: ${baseTheme.colors.gray[600]};
  min-height: 1.25rem;
`

const saveStatusErrorStyles = css`
  color: ${baseTheme.colors.crimson[700]};
`

const saveRowStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const sectionNavStyles = css`
  position: sticky;
  top: 3.25rem;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
  padding: 0.5rem 0;
  margin: 0 0 0.25rem 0;
  background: ${baseTheme.colors.clear[100]};
  border-bottom: 1px solid ${baseTheme.colors.gray[100]};
`

const sectionNavLinkStyles = css`
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

const sectionCardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
`

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
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font: inherit;
  color: ${baseTheme.colors.gray[900]};

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
    border-radius: 0.25rem;
  }
`

const sectionChevronStyles = (expanded: boolean) => css`
  display: inline-block;
  font-size: 0.65rem;
  line-height: 1;
  transform: rotate(${expanded ? "180deg" : "0deg"});
  transition: transform 0.15s ease;
  color: ${baseTheme.colors.gray[500]};
`

const sectionBodyStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`

const sectionTitleStyles = css`
  font-size: 1rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
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

const roleTitleStyles = css`
  font-size: 0.95rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[800]};
  margin: 0.75rem 0 0.25rem 0;
`

const dutiesTextStyles = css`
  font-size: 0.85rem;
  color: ${baseTheme.colors.gray[600]};
  margin: 0 0 0.5rem 0;
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

const courseTypeRowStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

const uhDetailsStyles = css`
  margin-top: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  background: ${baseTheme.colors.gray[50]};
  padding: 0;

  summary {
    cursor: pointer;
    padding: 0.65rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: ${baseTheme.colors.gray[800]};
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }
`

const uhDetailsBodyStyles = css`
  padding: 0 1rem 0.85rem 1rem;
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
 * One key contributor role block with duties text and assigned-persons field.
 */
function ContributorRoleBlock(props: {
  dutiesKey: (typeof CONTRIBUTOR_ROLES)[number]["dutiesKey"]
  field: ContributorFieldKey
  nameKey: (typeof CONTRIBUTOR_ROLES)[number]["nameKey"]
  register: UseFormRegister<AnalysisWorkspaceV1>
  t: TFunction
}) {
  const { dutiesKey, field, nameKey, register, t } = props
  return (
    <div>
      <p className={roleTitleStyles}>{t(nameKey)}</p>
      <p className={dutiesTextStyles}>
        {t("course-plans-analysis-role-responsibilities-label")}: {t(dutiesKey)}
      </p>
      <TextArea
        label={t("course-plans-analysis-assigned-persons")}
        rows={ROWS_STANDARD}
        {...register(field, nullIfEmpty)}
      />
    </div>
  )
}

/**
 * Checkbox groups for mode and content-format preferences using Controller (no watch()).
 */
function ModeCheckboxRow(props: { control: Control<AnalysisWorkspaceV1>; t: TFunction }) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>{t("course-plans-analysis-field-mode")}</legend>
      <div className={checkboxRowStyles}>
        <Controller
          name={FIELD_MODE_SYNCHRONOUS}
          control={control}
          render={({ field }) => (
            <Checkbox
              label={t("course-plans-analysis-mode-synchronous")}
              checked={Boolean(field.value)}
              onChange={(e) => {
                field.onChange(e.target.checked)
              }}
            />
          )}
        />
        <Controller
          name={FIELD_MODE_ASYNCHRONOUS}
          control={control}
          render={({ field }) => (
            <Checkbox
              label={t("course-plans-analysis-mode-asynchronous")}
              checked={Boolean(field.value)}
              onChange={(e) => {
                field.onChange(e.target.checked)
              }}
            />
          )}
        />
      </div>
    </fieldset>
  )
}

/**
 * Open-period checkboxes with "All" first; syncs open_period_all when individual periods change.
 */
function OpenPeriodCheckboxes(props: {
  control: Control<AnalysisWorkspaceV1>
  getValues: () => AnalysisWorkspaceV1
  setValue: ReturnType<typeof useForm<AnalysisWorkspaceV1>>["setValue"]
  t: TFunction
}) {
  const { control, getValues, setValue, t } = props

  const syncOpenPeriodAllFromState = (next: AnalysisWorkspaceV1) => {
    const allSelected =
      next.open_period_i && next.open_period_ii && next.open_period_iii && next.open_period_iv
    setValue(FIELD_OPEN_PERIOD_ALL, Boolean(allSelected), { shouldDirty: true })
  }

  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-open-periods")}
      </legend>
      <div className={checkboxGroupStyles}>
        <div className={checkboxRowStyles}>
          <Controller
            name={FIELD_OPEN_PERIOD_ALL}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t("course-plans-analysis-period-all")}
                checked={Boolean(field.value)}
                onChange={(e) => {
                  const c = e.target.checked
                  field.onChange(c)
                  if (c) {
                    setValue("open_period_i", true, { shouldDirty: true })
                    setValue("open_period_ii", true, { shouldDirty: true })
                    setValue("open_period_iii", true, { shouldDirty: true })
                    setValue("open_period_iv", true, { shouldDirty: true })
                  } else {
                    setValue("open_period_i", false, { shouldDirty: true })
                    setValue("open_period_ii", false, { shouldDirty: true })
                    setValue("open_period_iii", false, { shouldDirty: true })
                    setValue("open_period_iv", false, { shouldDirty: true })
                  }
                }}
              />
            )}
          />
          <Controller
            name={OPEN_PERIOD_I}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t("course-plans-analysis-period-i")}
                checked={Boolean(field.value)}
                onChange={(e) => {
                  const c = e.target.checked
                  field.onChange(c)
                  syncOpenPeriodAllFromState({ ...getValues(), [OPEN_PERIOD_I]: c })
                }}
              />
            )}
          />
          <Controller
            name={OPEN_PERIOD_II}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t("course-plans-analysis-period-ii")}
                checked={Boolean(field.value)}
                onChange={(e) => {
                  const c = e.target.checked
                  field.onChange(c)
                  syncOpenPeriodAllFromState({ ...getValues(), [OPEN_PERIOD_II]: c })
                }}
              />
            )}
          />
          <Controller
            name={OPEN_PERIOD_III}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t("course-plans-analysis-period-iii")}
                checked={Boolean(field.value)}
                onChange={(e) => {
                  const c = e.target.checked
                  field.onChange(c)
                  syncOpenPeriodAllFromState({ ...getValues(), [OPEN_PERIOD_III]: c })
                }}
              />
            )}
          />
          <Controller
            name={OPEN_PERIOD_IV}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t("course-plans-analysis-period-iv")}
                checked={Boolean(field.value)}
                onChange={(e) => {
                  const c = e.target.checked
                  field.onChange(c)
                  syncOpenPeriodAllFromState({ ...getValues(), [OPEN_PERIOD_IV]: c })
                }}
              />
            )}
          />
        </div>
      </div>
    </fieldset>
  )
}

/**
 * Content format checkboxes driven by Controller.
 */
function ContentFormatCheckboxes(props: { control: Control<AnalysisWorkspaceV1>; t: TFunction }) {
  const { control, t } = props
  return (
    <fieldset className={roleBlockStyles}>
      <legend className={sectionTitleStyles}>
        {t("course-plans-analysis-field-content-format")}
      </legend>
      <div className={checkboxRowStyles}>
        {CONTENT_FORMAT_FIELDS.map(([name, labelKey]) => (
          <Controller
            key={name}
            name={name}
            control={control}
            render={({ field }) => (
              <Checkbox
                label={t(labelKey)}
                checked={Boolean(field.value)}
                onChange={(e) => field.onChange(e.target.checked)}
              />
            )}
          />
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

  const form = useForm<AnalysisWorkspaceV1>({
    defaultValues: defaultAnalysisWorkspaceV1(),
  })

  const { control, handleSubmit, register, reset, setValue, getValues, watch, trigger } = form
  const { isDirty } = useFormState({ control })

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
    reset(parseAnalysisWorkspaceFromApi(workspaceData))
  }, [workspaceData, reset])

  const patchWorkspace = useCallback(
    (payload: AnalysisWorkspaceV1) =>
      patchCourseDesignerStageWorkspace(planId, STAGE_ANALYSIS, {
        schema: ANALYSIS_WORKSPACE_SCHEMA_V1,
        payload,
      }),
    [planId],
  )

  const handleSaveSuccess = useCallback(
    async (saved: AnalysisWorkspaceV1) => {
      reset(saved)
      setAutosaveError(false)
      setShowSavedStatus(true)
      await queryClient.invalidateQueries({ queryKey: coursePlanQueryKeys.detail(planId) })
      onDirtyChange?.(false)
    },
    [onDirtyChange, planId, queryClient, reset],
  )

  const autosaveMutation = useToastMutation(
    patchWorkspace,
    { notify: false },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables)
      },
      onError: () => {
        setAutosaveError(true)
      },
    },
  )

  const manualSaveMutation = useToastMutation(
    patchWorkspace,
    {
      notify: true,
      method: "PATCH",
      loadingText: t("course-plans-analysis-saving"),
    },
    {
      onSuccess: async (_data, variables) => {
        await handleSaveSuccess(variables)
      },
    },
  )

  const courseType = useWatch({ control, name: FIELD_COURSE_TYPE })

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
    autosaveMutation.mutate(getValues())
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

  const onSubmit = (data: AnalysisWorkspaceV1) => {
    manualSaveMutation.mutate(data)
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
      <div className={stickyToolbarStyles}>
        <div
          className={cx(saveStatusStyles, autosaveError && saveStatusErrorStyles)}
          role="status"
          aria-live="polite"
        >
          {statusText}
        </div>
        <div className={saveRowStyles}>
          <Button
            type="submit"
            variant="primary"
            size="medium"
            disabled={saving}
            aria-label={t("course-plans-analysis-sticky-save-aria")}
          >
            {saving ? t("course-plans-analysis-saving") : t("course-plans-analysis-save")}
          </Button>
        </div>
      </div>

      <nav className={sectionNavStyles} aria-label={t("course-plans-analysis-nav-aria-label")}>
        {SECTION_NAV_KEYS.map((key, index) => {
          const n = index + 1
          const sectionId = `${SECTION_DOM_PREFIX}${n}`
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
              {t(key)}
            </a>
          )
        })}
      </nav>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}1`}
        aria-labelledby="analysis-section-1-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(1)}
            aria-expanded={expandedSections[1] !== false}
            aria-controls="analysis-section-1-body"
          >
            <span className={sectionChevronStyles(expandedSections[1] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-1-heading">
              {t("course-plans-analysis-section-1")}
            </span>
          </button>
        </div>
        {expandedSections[1] !== false ? (
          <div id="analysis-section-1-body" className={sectionBodyStyles}>
            <TextField
              label={t("course-plans-analysis-field-course-title")}
              description={t("course-plans-analysis-description-course-title")}
              {...register("course_title", nullIfEmpty)}
            />
            <div className={twoColGridStyles}>
              <Controller
                name={FIELD_CREDITS}
                control={control}
                rules={{
                  validate: (v) =>
                    v == null ||
                    (typeof v === "number" && Number.isFinite(v)) ||
                    t("course-plans-analysis-error-credits-invalid"),
                }}
                render={({ field, fieldState }) => (
                  <TextField
                    label={t("course-plans-analysis-field-credits")}
                    description={t("course-plans-analysis-description-credits")}
                    inputMode={INPUT_MODE_DECIMAL}
                    autoComplete="off"
                    errorMessage={fieldState.error?.message}
                    value={field.value == null ? "" : String(field.value)}
                    onChange={(e) => {
                      const raw = e.target.value.trim()
                      if (raw === "") {
                        field.onChange(null)
                        return
                      }
                      const n = Number(raw.replace(",", "."))
                      field.onChange(Number.isFinite(n) ? n : null)
                    }}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <TextField
                label={t("course-plans-analysis-field-language")}
                description={t("course-plans-analysis-description-language")}
                {...register("language", nullIfEmpty)}
              />
            </div>
            <TextField
              label={t("course-plans-analysis-field-target-group")}
              description={t("course-plans-analysis-description-target-group")}
              {...register("target_group", nullIfEmpty)}
            />
            <div className={modeAndPeriodsRowStyles}>
              <ModeCheckboxRow control={control} t={t} />
              <OpenPeriodCheckboxes
                control={control}
                getValues={getValues}
                setValue={setValue}
                t={t}
              />
            </div>
            <TextField
              label={t("course-plans-analysis-field-responsible-teachers")}
              description={t("course-plans-analysis-description-responsible-teachers")}
              {...register("responsible_teachers", nullIfEmpty)}
            />
            <div className={twoColGridStyles}>
              <TextField
                label={t("course-plans-analysis-field-degree-programme")}
                description={t("course-plans-analysis-description-degree-programme")}
                {...register("degree_programme", nullIfEmpty)}
              />
              <div className={courseTypeRowStyles}>
                <RadioGroup
                  label={t("course-plans-analysis-field-course-type")}
                  name={FIELD_COURSE_TYPE}
                  value={courseType == null ? "" : courseType}
                  onChange={(v) =>
                    setValue("course_type", v === "" ? null : (v as AnalysisCourseType), {
                      shouldDirty: true,
                    })
                  }
                >
                  <Radio
                    value="Compulsory"
                    label={t("course-plans-analysis-course-type-compulsory")}
                  />
                  <Radio value="Elective" label={t("course-plans-analysis-course-type-elective")} />
                </RadioGroup>
                <Button
                  type="button"
                  variant="tertiary"
                  size="small"
                  onClick={() =>
                    setValue("course_type", null, {
                      shouldDirty: true,
                    })
                  }
                >
                  {t("course-plans-analysis-course-type-clear")}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}2`}
        aria-labelledby="analysis-section-2-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(2)}
            aria-expanded={expandedSections[2] !== false}
            aria-controls="analysis-section-2-body"
          >
            <span className={sectionChevronStyles(expandedSections[2] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-2-heading">
              {t("course-plans-analysis-section-2")}
            </span>
          </button>
        </div>
        {expandedSections[2] !== false ? (
          <div id="analysis-section-2-body" className={sectionBodyStyles}>
            <p className={staticTextStyles}>{t("course-plans-analysis-students-needs-intro")}</p>
            <TextArea
              label={t("course-plans-analysis-field-students-demographic")}
              rows={ROWS_LONG}
              {...register("students_demographic_data", nullIfEmpty)}
            />
          </div>
        ) : null}
      </section>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}3`}
        aria-labelledby="analysis-section-3-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(3)}
            aria-expanded={expandedSections[3] !== false}
            aria-controls="analysis-section-3-body"
          >
            <span className={sectionChevronStyles(expandedSections[3] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-3-heading">
              {t("course-plans-analysis-section-3")}
            </span>
          </button>
        </div>
        {expandedSections[3] !== false ? (
          <div id="analysis-section-3-body" className={sectionBodyStyles}>
            <TextArea
              label={t("course-plans-analysis-field-wishes-topics")}
              rows={ROWS_STANDARD}
              {...register("wishes_topics", nullIfEmpty)}
            />
            <ContentFormatCheckboxes control={control} t={t} />
            <TextArea
              label={t("course-plans-analysis-field-content-format-notes")}
              rows={ROWS_STANDARD}
              {...register("wishes_content_format_notes", nullIfEmpty)}
            />
            <TextArea
              label={t("course-plans-analysis-field-assessment")}
              rows={ROWS_STANDARD}
              {...register("wishes_assessment_text", nullIfEmpty)}
            />
            <TextArea
              label={t("course-plans-analysis-field-wishes-other")}
              rows={ROWS_STANDARD}
              {...register("wishes_other_suggestions", nullIfEmpty)}
            />
          </div>
        ) : null}
      </section>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}4`}
        aria-labelledby="analysis-section-4-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(4)}
            aria-expanded={expandedSections[4] !== false}
            aria-controls="analysis-section-4-body"
          >
            <span className={sectionChevronStyles(expandedSections[4] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-4-heading">
              {t("course-plans-analysis-section-4")}
            </span>
          </button>
        </div>
        {expandedSections[4] !== false ? (
          <div id="analysis-section-4-body" className={sectionBodyStyles}>
            <TextArea
              label={t("course-plans-analysis-field-market-results")}
              description={t("course-plans-analysis-description-market-results")}
              rows={ROWS_LONG}
              {...register("market_results", nullIfEmpty)}
            />
          </div>
        ) : null}
      </section>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}5`}
        aria-labelledby="analysis-section-5-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(5)}
            aria-expanded={expandedSections[5] !== false}
            aria-controls="analysis-section-5-body"
          >
            <span className={sectionChevronStyles(expandedSections[5] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-5-heading">
              {t("course-plans-analysis-section-5")}
            </span>
          </button>
        </div>
        {expandedSections[5] !== false ? (
          <div id="analysis-section-5-body" className={sectionBodyStyles}>
            <TextArea
              label={t("course-plans-analysis-field-resources-university")}
              rows={ROWS_STANDARD}
              {...register("resources_university", nullIfEmpty)}
            />
            <TextArea
              label={t("course-plans-analysis-field-resources-purchase")}
              rows={ROWS_STANDARD}
              {...register("resources_purchase_budget", nullIfEmpty)}
            />
            {showUhResources ? (
              <details className={uhDetailsStyles}>
                <summary>{t("course-plans-analysis-resources-uh-details-summary")}</summary>
                <div className={uhDetailsBodyStyles}>
                  <p className={staticTextStyles}>
                    {t("course-plans-analysis-resources-uh-heading")}
                  </p>
                  {uhLines.map((line, index) => (
                    <p key={`uh-line-${index}`} className={uhLineStyles}>
                      {linkifyResourceLine(line)}
                    </p>
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        className={sectionCardStyles}
        id={`${SECTION_DOM_PREFIX}6`}
        aria-labelledby="analysis-section-6-heading"
      >
        <div className={sectionHeaderRowStyles}>
          <button
            type="button"
            className={sectionToggleStyles}
            onClick={() => toggleSection(6)}
            aria-expanded={expandedSections[6] !== false}
            aria-controls="analysis-section-6-body"
          >
            <span className={sectionChevronStyles(expandedSections[6] !== false)} aria-hidden>
              {SECTION_TOGGLE_CHEVRON}
            </span>
            <span className={sectionTitleStyles} id="analysis-section-6-heading">
              {t("course-plans-analysis-section-6")}
            </span>
          </button>
        </div>
        {expandedSections[6] !== false ? (
          <div id="analysis-section-6-body" className={sectionBodyStyles}>
            <p className={staticTextStyles}>{t("course-plans-analysis-contributors-intro")}</p>
            {CONTRIBUTOR_ROLES.map((role) => (
              <ContributorRoleBlock
                key={role.field}
                field={role.field}
                nameKey={role.nameKey}
                dutiesKey={role.dutiesKey}
                register={register}
                t={t}
              />
            ))}
          </div>
        ) : null}
      </section>
    </form>
  )
}
