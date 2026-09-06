"use client"

import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AdminCourseModulePauseButton from "@/components/credit-registration/admin/AdminCourseModulePauseButton"
import { useCreditRegistrationCourseStats } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import type { ConfigFailureReason } from "@/components/credit-registration/admin/courseModuleStatus"
import {
  backfillGap,
  configFailureReason,
  configFailureReasonLabel,
  configFailureReasonOrOther,
  courseModuleStatus,
  courseModuleStatusLabel,
  courseModuleStatusTone,
  dominantConfigFailureReason,
  failureRatePercent,
  HIGH_FAILURE_RATE_PERCENT,
} from "@/components/credit-registration/admin/courseModuleStatus"
import FacetChip from "@/components/credit-registration/admin/FacetChip"
import { formatPercent } from "@/components/credit-registration/admin/percent"
import {
  ALIGN_END,
  DENSITY_COMPACT,
  LINK_QUIET,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TABLE_STACK,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  stackedCellCss,
  statusTriggerCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Checkbox,
  Dialog,
  Infobox,
  Link,
  MeterInline,
  QueryResult,
  RelativeTime,
  Select,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

const MODULE_QUERY = "?course_module_id="
const ATTENTION_QUERY = "&needs_admin_attention=true"
const SORT_NAME = "name"
const SORT_FAILURES = "failures"
const SORT_BACKFILL = "backfill"

/** How many modules the same structured check has to fail before it earns its own banner. */
const MANY_MODULES_THRESHOLD = 3

type CourseComparator = (
  a: CreditRegistrationCourseStats,
  b: CreditRegistrationCourseStats,
) => number

const byCourseName: CourseComparator = (a, b) => a.course_name.localeCompare(b.course_name)

type CourseSortKey = typeof SORT_NAME | typeof SORT_FAILURES | typeof SORT_BACKFILL

const SORT_COMPARATORS = {
  [SORT_NAME]: byCourseName,
  [SORT_FAILURES]: (a, b) => (failureRatePercent(b) ?? -1) - (failureRatePercent(a) ?? -1),
  [SORT_BACKFILL]: (a, b) => backfillGap(b) - backfillGap(a),
} satisfies Record<CourseSortKey, CourseComparator>

interface ViewFields {
  sort: CourseSortKey
  problemsOnly: boolean
}

/** Centers an inline checkbox against the taller floating-label select beside it in the toolbar. */
const checkboxAlignCss = css`
  align-self: center;
`

/** A pause reason is free text and can run long; one line keeps the badge row from growing per-row. */
const truncatedNoteCss = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CONFIG_FAILURE_BANNER_KEYS = {
  product_token: "credit-registration-admin-config-failure-banner-product-token",
  course_code: "credit-registration-admin-config-failure-banner-course-code",
} as const

/** Which of the four configuration checks passed, in a dialog so the row stays one line high. */
const ConfigDetail: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const checks: { label: string; value: boolean | null }[] = [
    {
      label: t("credit-registration-admin-check-course-code"),
      value: module.check.course_code_resolves ?? null,
    },
    {
      label: t("credit-registration-admin-check-product-token"),
      value: module.check.product_token_found ?? null,
    },
    { label: t("credit-registration-admin-check-ects"), value: module.ects_credits !== null },
    {
      label: t("credit-registration-admin-check-realisation-pinned"),
      value: module.active_realisation_count > 0,
    },
  ]
  return (
    <>
      <button type="button" className={statusTriggerCss} onClick={() => setOpen(true)}>
        <span>{t("credit-registration-admin-which-checks")}</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("credit-registration-admin-column-configuration")}
      >
        <div className={sectionCss}>
          <div className={rowCss}>
            {checks.map((check) => (
              <Badge
                key={check.label}
                // Never checked is not checked and failed, so it stays neutral rather than red.
                tone={
                  check.value === null ? TONE.NEUTRAL : check.value ? TONE.SUCCESS : TONE.DANGER
                }
              >
                {check.value === null
                  ? `${check.label}: ${t("credit-registration-admin-check-not-checked")}`
                  : check.label}
              </Badge>
            ))}
          </div>
          {module.check.message && (
            <p className={cx(noteCss, monospaceCss)}>{module.check.message}</p>
          )}
          <p className={noteCss}>
            {module.config_checked_at === null ? (
              t("credit-registration-admin-never-config-checked")
            ) : (
              <>
                {t("credit-registration-admin-config-checked-at")}{" "}
                <RelativeTime at={module.config_checked_at} absoluteTime={TIME_COMPACT} />
              </>
            )}
          </p>
        </div>
      </Dialog>
    </>
  )
}

/** Failed share of the module's finished rows: a percent and a bar on every row, so the shape of the
 * column never itself looks like the signal. Only the tone marks a rate worth acting on. */
const FailureRateCell: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
  const rate = failureRatePercent(module)
  const terminal = module.success_count + module.failed_count
  if (rate === null) {
    return (
      <span>
        {t("credit-registration-admin-failure-count-value", {
          failed: module.failed_count,
          terminal,
        })}
      </span>
    )
  }
  return (
    <MeterInline
      value={module.failed_count}
      maxValue={terminal}
      threshold={(terminal * HIGH_FAILURE_RATE_PERCENT) / 100}
      tone={rate > HIGH_FAILURE_RATE_PERCENT ? TONE.DANGER : TONE.NEUTRAL}
      label={t("credit-registration-admin-failure-rate-label", {
        failed: module.failed_count,
        terminal,
        percent: formatPercent(rate),
      })}
      valueText={t("credit-registration-admin-failure-count-percent-value", {
        failed: module.failed_count,
        terminal,
        percent: formatPercent(rate),
      })}
    />
  )
}

/** Registrations against eligible completions; the gap itself only earns a colour once it is non-zero. */
const BackfillCell: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
  const gap = backfillGap(module)
  const valueText = t("credit-registration-admin-backfill-value", {
    registered: module.registration_count,
    eligible: module.eligible_completion_count,
  })
  if (module.eligible_completion_count === 0) {
    return <span>{valueText}</span>
  }
  return (
    <MeterInline
      value={module.registration_count}
      maxValue={module.eligible_completion_count}
      tone={gap === 0 ? TONE.NEUTRAL : TONE.WARNING}
      label={t("credit-registration-admin-backfill-label", {
        registered: module.registration_count,
        eligible: module.eligible_completion_count,
      })}
      valueText={valueText}
    />
  )
}

const stripModulePrefix = (value: string): string => value.replace(/^Module\s+/, "")

/** Module name and UH course code are one string in some configurations; printing it twice is noise. */
const moduleSubtitle = (module: CreditRegistrationCourseStats): string[] => {
  const seen = new Set<string>()
  return [module.course_module_name, module.uh_course_code].filter((part): part is string => {
    if (!part) {
      return false
    }
    const key = stripModulePrefix(part)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/** Which course modules register credits, how well each does it, and what is wrong with the rest. */
const CoursesPage: React.FC = () => {
  const { t } = useTranslation()
  const statsQuery = useCreditRegistrationCourseStats()
  const { control, watch } = useForm<ViewFields>({
    defaultValues: { sort: SORT_NAME, problemsOnly: false },
  })
  const sort = watch("sort")
  const problemsOnly = watch("problemsOnly")
  const [reasonFilter, setReasonFilter] = useState<ConfigFailureReason | null>(null)

  return (
    <section className={sectionCss}>
      <QueryResult
        query={statsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(stats) => {
          const pausedCount = stats.modules.filter((module) => module.paused_at !== null).length
          const shown = stats.modules.filter((module) => {
            const isProblem = courseModuleStatus(module) !== "ok" || module.paused_at !== null
            if (problemsOnly && !isProblem) {
              return false
            }
            return reasonFilter === null || configFailureReason(module) === reasonFilter
          })
          const modules = shown.toSorted(SORT_COMPARATORS[sort])
          const dominantFailure = dominantConfigFailureReason(stats.modules)

          return (
            <>
              <StatTileList ariaLabel={t("credit-registration-heading-courses")} maxColumns={3}>
                <StatTile
                  label={t("credit-registration-admin-modules-enabled")}
                  value={stats.modules.length}
                />
                <StatTile
                  label={t("credit-registration-admin-modules-misconfigured")}
                  value={stats.misconfigured_count}
                  alertWhenNonZero
                />
                <StatTile
                  label={t("credit-registration-admin-modules-paused")}
                  value={pausedCount}
                />
              </StatTileList>
              <div className={controlsCss}>
                <div className={controlCss}>
                  <Select
                    name="sort"
                    control={control}
                    label={t("credit-registration-admin-sort")}
                    options={[
                      { value: SORT_NAME, label: t("credit-registration-admin-sort-course-name") },
                      {
                        value: SORT_FAILURES,
                        label: t("credit-registration-admin-sort-failure-rate"),
                      },
                      {
                        value: SORT_BACKFILL,
                        label: t("credit-registration-admin-sort-backfill-gap"),
                      },
                    ]}
                  />
                </div>
                <div className={checkboxAlignCss}>
                  <Checkbox
                    name="problemsOnly"
                    control={control}
                    isInline
                    label={t("credit-registration-admin-only-problems")}
                  />
                </div>
              </div>
              {dominantFailure && dominantFailure.count >= MANY_MODULES_THRESHOLD && (
                <Infobox tone={TONE.NEUTRAL}>
                  <span className={rowCss}>
                    <span>
                      {t(CONFIG_FAILURE_BANNER_KEYS[dominantFailure.reason], {
                        count: dominantFailure.count,
                      })}
                    </span>
                    <FacetChip
                      label={t("credit-registration-admin-filter-to-these-modules")}
                      count={dominantFailure.count}
                      isSelected={reasonFilter === dominantFailure.reason}
                      onToggle={() =>
                        setReasonFilter((current) =>
                          current === dominantFailure.reason ? null : dominantFailure.reason,
                        )
                      }
                    />
                  </span>
                </Infobox>
              )}
              <Table
                caption={t("credit-registration-heading-courses-table")}
                density={DENSITY_COMPACT}
                responsive={TABLE_STACK}
                rowKey={(row) => row.course_module_id}
                rows={modules}
                emptyState={t("credit-registration-admin-no-enabled-modules")}
                columns={[
                  {
                    header: t("label-course"),
                    grow: true,
                    minWidth: "14rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <Link
                          href={`${creditRegistrationRegistrationsRoute()}${MODULE_QUERY}${row.course_module_id}`}
                          appearance={LINK_QUIET}
                        >
                          {row.course_name}
                        </Link>
                        <span className={cx(noteCss, monospaceCss)}>
                          {moduleSubtitle(row).join(MIDDLE_DOT)}
                        </span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-status"),
                    minWidth: "16rem",
                    cell: (row) => {
                      const status = courseModuleStatus(row)
                      const isPaused = row.paused_at !== null
                      return (
                        <span className={stackedCellCss}>
                          <span className={rowCss}>
                            {isPaused && (
                              <Badge tone={TONE.NEUTRAL} size="compact">
                                {t("credit-registration-admin-module-paused")}
                              </Badge>
                            )}
                            <Badge tone={courseModuleStatusTone(status)} size="compact">
                              {courseModuleStatusLabel(t, status)}
                            </Badge>
                          </span>
                          {isPaused && row.pause_reason && (
                            <span
                              className={cx(noteCss, truncatedNoteCss)}
                              title={row.pause_reason}
                            >
                              {row.pause_reason}
                            </span>
                          )}
                          {row.check.message && (
                            <span className={noteCss}>
                              {configFailureReasonLabel(t, configFailureReasonOrOther(row))}{" "}
                              <ConfigDetail module={row} />
                            </span>
                          )}
                        </span>
                      )
                    },
                  },
                  {
                    header: t("credit-registration-admin-column-backfill-gap"),
                    align: ALIGN_END,
                    minWidth: "8rem",
                    cell: (row) => <BackfillCell module={row} />,
                  },
                  {
                    header: t("credit-registration-admin-column-registered"),
                    align: ALIGN_END,
                    minWidth: "6rem",
                    nowrap: true,
                    cell: (row) => row.success_count,
                  },
                  {
                    header: t("credit-registration-admin-column-failed"),
                    align: ALIGN_END,
                    minWidth: "8rem",
                    cell: (row) => <FailureRateCell module={row} />,
                  },
                  {
                    header: t("credit-registration-admin-column-needs-attention"),
                    align: ALIGN_END,
                    minWidth: "6rem",
                    nowrap: true,
                    cell: (row) =>
                      row.needs_admin_attention_count === 0 ? (
                        row.needs_admin_attention_count
                      ) : (
                        <Link
                          href={`${creditRegistrationRegistrationsRoute()}${MODULE_QUERY}${row.course_module_id}${ATTENTION_QUERY}`}
                          appearance={LINK_QUIET}
                        >
                          {row.needs_admin_attention_count}
                        </Link>
                      ),
                  },
                  {
                    header: t("label-actions"),
                    minWidth: "4rem",
                    cell: (row) => (
                      <AdminCourseModulePauseButton
                        courseId={row.course_id}
                        courseModuleId={row.course_module_id}
                        courseModuleName={row.course_module_name ?? row.course_name}
                        paused={row.paused_at !== null}
                      />
                    ),
                  },
                ]}
              />
              <p className={cx(noteCss, proseCss)}>
                {t("credit-registration-admin-config-recomputed-note")}
              </p>
            </>
          )
        }}
      </QueryResult>
    </section>
  )
}

export default CoursesPage
