"use client"

import { cx } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AdminCourseModulePauseButton from "@/components/credit-registration/admin/AdminCourseModulePauseButton"
import { useCreditRegistrationCourseStats } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import {
  backfillGap,
  courseModuleStatus,
  courseModuleStatusLabel,
  courseModuleStatusTone,
  failureRatePercent,
} from "@/components/credit-registration/admin/courseModuleStatus"
import { formatPercent } from "@/components/credit-registration/admin/percent"
import {
  ALIGN_END,
  DENSITY_COMPACT,
  LINK_QUIET,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_COMPACT,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  creditRegistrationRegistrationsRoute,
  manageCourseModulesRoute,
} from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  Link,
  Meter,
  QueryResult,
  RelativeTime,
  Select,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const MODULE_QUERY = "?course_module_id="
// oxlint-disable-next-line i18next/no-literal-string
const ATTENTION_QUERY = "&needs_admin_attention=true"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_NAME = "name"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_FAILURES = "failures"
// oxlint-disable-next-line i18next/no-literal-string
const SORT_BACKFILL = "backfill"

/** Where a failure rate stops being noise and starts being a course to look at. */
const HIGH_FAILURE_RATE_PERCENT = 20

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
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-which-checks")}
      </Button>
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

/** Failed share of the module's finished rows, with the cutoff that made the row red as a tick. */
const FailureRateCell: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
  const rate = failureRatePercent(module)
  const terminal = module.success_count + module.failed_count
  return (
    <span className={stackedCellCss}>
      <span>{module.failed_count}</span>
      {rate === null ? (
        <span className={noteCss}>{t("credit-registration-admin-too-few-to-rate")}</span>
      ) : (
        <Meter
          value={module.failed_count}
          maxValue={terminal}
          threshold={(terminal * HIGH_FAILURE_RATE_PERCENT) / 100}
          showLabel={false}
          tone={rate > HIGH_FAILURE_RATE_PERCENT ? TONE.DANGER : TONE.NEUTRAL}
          label={t("credit-registration-admin-failure-rate-label", {
            failed: module.failed_count,
            terminal,
            percent: formatPercent(rate),
          })}
        />
      )}
    </span>
  )
}

/** The gap is the number to act on; the fraction behind it is the bar. */
const BackfillCell: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
  const gap = backfillGap(module)
  return (
    <span className={stackedCellCss}>
      <span>{gap}</span>
      {module.eligible_completion_count > 0 && (
        <Meter
          value={module.registration_count}
          maxValue={module.eligible_completion_count}
          showLabel={false}
          tone={gap === 0 ? TONE.SUCCESS : TONE.NEUTRAL}
          label={t("credit-registration-admin-backfill-label", {
            registered: module.registration_count,
            eligible: module.eligible_completion_count,
          })}
        />
      )}
    </span>
  )
}

/** Module name and UH course code are one string in some configurations; printing it twice is noise. */
const moduleSubtitle = (module: CreditRegistrationCourseStats): string[] =>
  [module.course_module_name, module.uh_course_code].filter(
    (part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index,
  )

/** Which course modules register credits, how well each does it, and what is wrong with the rest. */
const CoursesPage: React.FC = () => {
  const { t } = useTranslation()
  const statsQuery = useCreditRegistrationCourseStats()
  const { control, watch } = useForm<ViewFields>({
    defaultValues: { sort: SORT_NAME, problemsOnly: false },
  })
  const sort = watch("sort")
  const problemsOnly = watch("problemsOnly")

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-courses")}</h2>
      <QueryResult query={statsQuery} refreshIndicator={QUIET_REFRESH}>
        {(stats) => {
          const pausedCount = stats.modules.filter((module) => module.paused_at !== null).length
          const shown = stats.modules.filter(
            (module) => !problemsOnly || courseModuleStatus(module) !== "ok",
          )
          const modules = shown.toSorted(SORT_COMPARATORS[sort])
          return (
            <>
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
                <Checkbox
                  name="problemsOnly"
                  control={control}
                  isInline
                  label={t("credit-registration-admin-only-problems")}
                />
              </div>
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
              <Table
                caption={t("credit-registration-heading-courses-table")}
                density={DENSITY_COMPACT}
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
                      return (
                        <span className={stackedCellCss}>
                          <span className={rowCss}>
                            <Badge
                              tone={courseModuleStatusTone(status)}
                              size="compact"
                              {...includeIf(row.pause_reason, { title: row.pause_reason })}
                            >
                              {courseModuleStatusLabel(t, status)}
                            </Badge>
                            {row.check.message && <ConfigDetail module={row} />}
                          </span>
                          {/* Inline rather than behind the dialog: what is broken is the next
                              question, and it has to be answerable while scanning. */}
                          {row.check.message && (
                            <span className={cx(noteCss, monospaceCss)}>{row.check.message}</span>
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
                    minWidth: "11rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <AdminCourseModulePauseButton
                          courseModuleId={row.course_module_id}
                          courseModuleName={row.course_module_name ?? row.course_name}
                          paused={row.paused_at !== null}
                        />
                        <Link href={manageCourseModulesRoute(row.course_id)}>
                          {t("credit-registration-admin-edit-module-configuration")}
                        </Link>
                      </span>
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
