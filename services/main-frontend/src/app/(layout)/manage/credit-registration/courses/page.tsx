"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import AdminCourseModulePauseButton from "@/components/credit-registration/admin/AdminCourseModulePauseButton"
import { useCreditRegistrationCourseStats } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import { TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  stackedCellCss,
  tilesCss,
} from "@/components/credit-registration/styles"
import type { CreditRegistrationCourseStats } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import {
  creditRegistrationRegistrationsRoute,
  manageCourseModulesRoute,
} from "@/shared-module/common/utils/routes"
import { Badge, Link, Meter, QueryResult, StatTile, Table } from "@/shared-module/components"

// oxlint-disable-next-line i18next/no-literal-string
const MODULE_QUERY = "?course_module_id="
// Not from the backend's threshold config: that payload is being slimmed down separately, and this
// tab's coloring is cosmetic rather than an alerting rule, so it keeps its own fixed cutoffs.
const AMBER_FAILURE_RATE = 5
const RED_FAILURE_RATE = 20
const PERCENT = 100

const chipsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
`

const backfillCss = css`
  min-width: 9rem;
`

/** No terminal rows, no rate: a course nobody has finished yet is not a course failing. */
const failureRate = (module: CreditRegistrationCourseStats): number | null => {
  const terminal = module.success_count + module.failed_count
  return terminal === 0 ? null : (module.failed_count / terminal) * PERCENT
}

const ConfigChips: React.FC<{ module: CreditRegistrationCourseStats }> = ({ module }) => {
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
    {
      label: t("credit-registration-admin-check-ects"),
      value: module.ects_credits !== null,
    },
    {
      label: t("credit-registration-admin-check-realisation-pinned"),
      value: module.active_realisation_count > 0,
    },
  ]
  return (
    <div className={chipsCss}>
      {checks.map((check) => (
        <Badge
          key={check.label}
          // Never checked is not checked and failed, so it stays neutral rather than red.
          tone={check.value === null ? TONE.NEUTRAL : check.value ? TONE.SUCCESS : TONE.WARNING}
        >
          {check.label}
          {check.value === null && `: ${t("credit-registration-admin-check-not-checked")}`}
        </Badge>
      ))}
    </div>
  )
}

const CoursesPage: React.FC = () => {
  const { t } = useTranslation()
  const statsQuery = useCreditRegistrationCourseStats()

  return (
    <QueryResult query={statsQuery}>
      {(stats) => {
        const pausedCount = stats.modules.filter((module) => module.paused_at !== null).length
        // Row one is the course most worth looking at; a module nobody has finished sorts last.
        const modules = stats.modules.toSorted(
          (a, b) => (failureRate(b) ?? -1) - (failureRate(a) ?? -1),
        )
        return (
          <div className={sectionsCss}>
            <section className={sectionCss}>
              <h2 className={headingCss}>{t("credit-registration-heading-courses")}</h2>
              <div className={tilesCss}>
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
              </div>
              <p className={noteCss}>{t("credit-registration-admin-config-recomputed-note")}</p>
            </section>
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
                        <span className={noteCss}>{row.course_module_name}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("credit-registration-admin-column-course-code"),
                    cell: (row) =>
                      row.uh_course_code ? <code>{row.uh_course_code}</code> : ABSENT,
                  },
                  {
                    header: t("label-status"),
                    cell: (row) => (
                      <div className={chipsCss}>
                        {row.paused_at && (
                          <Badge
                            tone={TONE.WARNING}
                            {...includeIf(row.pause_reason, { title: row.pause_reason })}
                          >
                            {t("credit-registration-admin-module-paused")}
                          </Badge>
                        )}
                        {row.old_flow_also_enabled && (
                          <Badge tone={TONE.WARNING}>
                            {t("credit-registration-admin-old-flow-also-enabled")}
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    header: t("credit-registration-admin-column-configuration"),
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <ConfigChips module={row} />
                        {row.check.message && <span className={noteCss}>{row.check.message}</span>}
                        <span className={noteCss}>
                          {row.config_checked_at === null
                            ? t("credit-registration-admin-never-config-checked")
                            : t("credit-registration-admin-config-checked-at")}{" "}
                          {row.config_checked_at !== null && (
                            <RelativeTime at={row.config_checked_at} />
                          )}
                        </span>
                      </span>
                    ),
                  },
                  {
                    header: t("credit-registration-admin-column-backfill"),
                    cell: (row) => (
                      <span className={backfillCss}>
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
                    header: t("credit-registration-admin-column-awaiting-consent"),
                    cell: (row) => row.awaiting_consent_count,
                  },
                  {
                    header: t("credit-registration-admin-column-in-flight"),
                    cell: (row) => row.in_flight_count,
                  },
                  {
                    header: t("credit-registration-admin-column-registered"),
                    cell: (row) => row.success_count,
                  },
                  {
                    header: t("credit-registration-admin-column-failed"),
                    cell: (row) => row.failed_count,
                  },
                  {
                    header: t("credit-registration-admin-column-failure-rate"),
                    cell: (row) => {
                      const rate = failureRate(row)
                      if (rate === null) {
                        return ABSENT
                      }
                      const tone =
                        rate > RED_FAILURE_RATE
                          ? TONE.WARNING
                          : rate > AMBER_FAILURE_RATE
                            ? TONE.INFO
                            : TONE.NEUTRAL
                      return <Badge tone={tone}>{`${Math.round(rate)} %`}</Badge>
                    },
                  },
                  {
                    header: t("credit-registration-admin-column-abandoned"),
                    cell: (row) => row.abandoned_count,
                  },
                  {
                    header: t("credit-registration-admin-column-needs-attention"),
                    cell: (row) => row.needs_admin_attention_count,
                  },
                  {
                    header: t("label-error-code"),
                    cell: (row) =>
                      row.top_error_code ? <code>{row.top_error_code}</code> : ABSENT,
                  },
                  {
                    header: t("credit-registration-admin-last-registered"),
                    cell: (row) => <RelativeTime at={row.last_registered_at} />,
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
            <p className={noteCss}>{t("credit-registration-admin-abandoned-not-a-failure-note")}</p>
          </div>
        )
      }}
    </QueryResult>
  )
}

export default CoursesPage
