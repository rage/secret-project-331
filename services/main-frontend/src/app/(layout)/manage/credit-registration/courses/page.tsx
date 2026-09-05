"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import AccountLinkingSection from "@/components/credit-registration/admin/AccountLinkingSection"
import AdminCourseModulePauseButton from "@/components/credit-registration/admin/AdminCourseModulePauseButton"
import { useCreditRegistrationCourseStats } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import type { CourseModuleStatus } from "@/components/credit-registration/admin/courseModuleStatus"
import {
  backfillGap,
  courseModuleStatus,
  failureRatePercent,
} from "@/components/credit-registration/admin/courseModuleStatus"
import {
  ALIGN_END,
  MIDDLE_DOT,
  QUIET_REFRESH,
  TIME_IN_TITLE,
  TONE,
} from "@/components/credit-registration/constants"
import {
  controlCss,
  controlsCss,
  headingCss,
  noteCss,
  rowCss,
  sectionCss,
  sectionsCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  creditRegistrationRegistrationsRoute,
  manageCourseModulesRoute,
} from "@/shared-module/common/utils/routes"
import type { BadgeTone } from "@/shared-module/components"
import {
  Badge,
  Checkbox,
  Disclosure,
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

const STATUS_KEYS = {
  broken_config: "credit-registration-admin-status-broken-config",
  paused: "credit-registration-admin-module-paused",
  double_registering: "credit-registration-admin-old-flow-also-enabled",
  failing: "credit-registration-admin-status-failing",
  unchecked: "credit-registration-admin-never-config-checked",
  ok: "credit-registration-admin-status-ok",
} as const satisfies Record<CourseModuleStatus, string>

const STATUS_TONES = {
  broken_config: TONE.DANGER,
  paused: TONE.NEUTRAL,
  double_registering: TONE.DANGER,
  failing: TONE.DANGER,
  unchecked: TONE.NEUTRAL,
  ok: TONE.SUCCESS,
} as const satisfies Record<CourseModuleStatus, BadgeTone>

interface ViewFields {
  sort: string
  problemsOnly: boolean
}

const meterCss = css`
  min-width: 9rem;
`

const ConfigDetail: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
  const { t } = useTranslation()
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
    <Disclosure title={t("credit-registration-admin-column-configuration")}>
      <div className={rowCss}>
        {checks.map((check) => (
          <Badge
            key={check.label}
            // Never checked is not checked and failed, so it stays neutral rather than red.
            tone={check.value === null ? TONE.NEUTRAL : check.value ? TONE.SUCCESS : TONE.DANGER}
          >
            {check.value === null
              ? `${check.label}: ${t("credit-registration-admin-check-not-checked")}`
              : check.label}
          </Badge>
        ))}
      </div>
      {module.check.message && <p className={noteCss}>{module.check.message}</p>}
      <p className={noteCss}>
        {module.config_checked_at === null ? (
          t("credit-registration-admin-never-config-checked")
        ) : (
          <>
            {t("credit-registration-admin-config-checked-at")}{" "}
            <RelativeTime at={module.config_checked_at} absoluteTime={TIME_IN_TITLE} />
          </>
        )}
      </p>
    </Disclosure>
  )
}

const CourseSection: React.FC = () => {
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
          const modules = shown.toSorted((a, b) => {
            if (sort === SORT_FAILURES) {
              return (failureRatePercent(b) ?? -1) - (failureRatePercent(a) ?? -1)
            }
            if (sort === SORT_BACKFILL) {
              return backfillGap(b) - backfillGap(a)
            }
            return a.course_name.localeCompare(b.course_name)
          })
          return (
            <>
              <StatTileList ariaLabel={t("credit-registration-heading-courses")}>
                <StatTile
                  label={t("credit-registration-admin-modules-enabled")}
                  value={stats.modules.length}
                />
                <StatTile
                  label={t("credit-registration-admin-modules-misconfigured")}
                  value={stats.misconfigured_count}
                  {...includeIf(stats.misconfigured_count > 0, { tone: TONE.ALERT })}
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
                <Checkbox
                  name="problemsOnly"
                  control={control}
                  label={t("credit-registration-admin-only-problems")}
                />
              </div>
              {modules.length === 0 ? (
                <p className={noteCss}>{t("credit-registration-admin-no-enabled-modules")}</p>
              ) : (
                <Table
                  caption={t("credit-registration-heading-courses-table")}
                  rowKey={(row) => row.course_module_id}
                  rows={modules}
                  columns={[
                    {
                      header: t("label-course"),
                      cell: (row) => (
                        <span className={stackedCellCss}>
                          <Link
                            href={`${creditRegistrationRegistrationsRoute()}${MODULE_QUERY}${row.course_module_id}`}
                          >
                            {row.course_name}
                          </Link>
                          <span className={noteCss}>
                            {[row.course_module_name, row.uh_course_code]
                              .filter(Boolean)
                              .join(MIDDLE_DOT)}
                          </span>
                        </span>
                      ),
                    },
                    {
                      header: t("label-status"),
                      cell: (row) => {
                        const status = courseModuleStatus(row)
                        return (
                          <span className={stackedCellCss}>
                            <Badge
                              tone={STATUS_TONES[status]}
                              {...includeIf(row.pause_reason, { title: row.pause_reason })}
                            >
                              {t(STATUS_KEYS[status])}
                            </Badge>
                            {status !== "ok" && <ConfigDetail module={row} />}
                          </span>
                        )
                      },
                    },
                    {
                      header: t("credit-registration-admin-column-backfill"),
                      cell: (row) => (
                        <span className={meterCss}>
                          <Meter
                            value={row.registration_count}
                            maxValue={Math.max(row.eligible_completion_count, 1)}
                            label={t("credit-registration-admin-column-backfill")}
                            valueLabel={`${row.registration_count} / ${row.eligible_completion_count}`}
                            showLabel={false}
                          />
                        </span>
                      ),
                    },
                    {
                      header: t("credit-registration-admin-column-registered"),
                      align: ALIGN_END,
                      cell: (row) => row.success_count,
                    },
                    {
                      header: t("credit-registration-admin-column-failed"),
                      align: ALIGN_END,
                      cell: (row) => {
                        const rate = failureRatePercent(row)
                        return rate === null
                          ? row.failed_count
                          : `${row.failed_count} (${Math.round(rate)} %)`
                      },
                    },
                    {
                      header: t("credit-registration-admin-column-needs-attention"),
                      align: ALIGN_END,
                      cell: (row) =>
                        row.needs_admin_attention_count === 0 ? (
                          row.needs_admin_attention_count
                        ) : (
                          <Link
                            href={`${creditRegistrationRegistrationsRoute()}${MODULE_QUERY}${row.course_module_id}${ATTENTION_QUERY}`}
                          >
                            {row.needs_admin_attention_count}
                          </Link>
                        ),
                    },
                    {
                      header: t("label-actions"),
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
              )}
              <p className={noteCss}>{t("credit-registration-admin-config-recomputed-note")}</p>
            </>
          )
        }}
      </QueryResult>
    </section>
  )
}

/** Which courses register credits, and how their students get a student number onto an account. */
const CoursesPage: React.FC = () => (
  <div className={sectionsCss}>
    <CourseSection />
    <AccountLinkingSection />
  </div>
)

export default CoursesPage
