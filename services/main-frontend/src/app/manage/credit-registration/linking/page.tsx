"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import {
  sendStatusLabel,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminResendLinkingEmailDialog from "@/components/credit-registration/admin/AdminResendLinkingEmailDialog"
import RelativeTime from "@/components/credit-registration/admin/RelativeTime"
import { adminUnlinkStudentNumber } from "@/generated/api/sdk.generated"
import type { AccountLinkingStats, EmailSendStatus } from "@/generated/api/types.generated"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  Button,
  Dialog,
  Meter,
  QueryResult,
  StatTile,
  Table,
  TextArea,
} from "@/shared-module/components"

const WINDOW_DAYS = 30
const STUDENT_NUMBER_PAGE_SIZE = 25
/** The explorer filter behind the "waiting for a number" tile. */
// oxlint-disable-next-line i18next/no-literal-string
const WAITING_QUERY = "?state=pending_student_number"
// oxlint-disable-next-line i18next/no-literal-string
const ALERT_TONE = "alert" as const
// oxlint-disable-next-line i18next/no-literal-string
const WARNING_BADGE = "warning" as const
// oxlint-disable-next-line i18next/no-literal-string
const NEUTRAL_BADGE = "neutral" as const
// oxlint-disable-next-line i18next/no-literal-string
const SUCCESS_BADGE = "success" as const
// oxlint-disable-next-line i18next/no-literal-string
const ADMIN_MANUAL = "admin_manual"
// oxlint-disable-next-line i18next/no-literal-string
const SEND_FAILED: EmailSendStatus = "send_failed"
/** Separator between identifiers on one line. Not prose, so not translated. */
// oxlint-disable-next-line i18next/no-literal-string
const DOT = " · "
const ABSENT = "-"

const sectionsCss = css`
  display: grid;
  gap: 2rem;
`

const sectionCss = css`
  display: grid;
  gap: 0.75rem;
`

const headingCss = css`
  font-weight: 500;
  margin: 0;
`

const noteCss = css`
  color: var(--color-gray-500);
  font-size: var(--font-size-1);
  margin: 0;
`

const tilesCss = css`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
`

const funnelCss = css`
  display: grid;
  gap: 0.5rem;
  max-width: 40rem;
`

const formCss = css`
  display: grid;
  gap: 0.75rem;
`

const listCss = css`
  margin: 0;
  padding-inline-start: 1rem;
`

const UnlinkButton: React.FC<{ verifiedStudentNumberId: string; number: string }> = ({
  verifiedStudentNumberId,
  number,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const { control, handleSubmit, watch } = useForm<{ reason: string }>({
    defaultValues: { reason: "" },
  })
  const reason = watch("reason")
  const mutation = useToastMutation(
    (fields: { reason: string }) =>
      adminUnlinkStudentNumber({
        path: { verified_student_number_id: verifiedStudentNumberId },
        body: { reason: fields.reason },
      }),
    { notify: true, method: "POST" },
    {
      onSuccess: () => {
        setOpen(false)
        void queryClient.invalidateQueries()
      },
    },
  )

  return (
    <>
      <Button variant="tertiary" size="medium" onClick={() => setOpen(true)}>
        {t("button-text-unlink")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("button-text-unlink")}>
        <form className={formCss} onSubmit={handleSubmit((fields) => mutation.mutate(fields))}>
          <p>{t("credit-registration-admin-unlink-warning", { number })}</p>
          <TextArea
            name="reason"
            control={control}
            label={t("label-reason")}
            rules={{ required: t("required-field") }}
          />
          <Button
            variant="primary"
            size="medium"
            type="submit"
            disabled={mutation.isPending || reason.trim() === ""}
          >
            {t("button-text-confirm")}
          </Button>
        </form>
      </Dialog>
    </>
  )
}

const FunnelSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  const scale = Math.max(funnel.persons_discovered_last_run, funnel.mails_claimed_in_window, 1)
  const manualTotal =
    stats.links_total_by_method.find((row) => row.verified_via === ADMIN_MANUAL)?.count ?? 0
  const steps = [
    {
      label: t("credit-registration-admin-funnel-discovered"),
      value: funnel.persons_discovered_last_run,
    },
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: funnel.already_linked_last_run,
    },
    {
      label: t("credit-registration-admin-funnel-mails-claimed"),
      value: funnel.mails_claimed_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-mails-sent"),
      value: funnel.mails_sent_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-numbers-claimed"),
      value: funnel.numbers_claimed_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-manual-links"),
      value: funnel.manual_links_in_window,
    },
  ]
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-linking-funnel")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-funnel-mixed-denominator-note")}</p>
      <div className={funnelCss}>
        {steps.map((step) => (
          <Meter
            key={step.label}
            value={step.value}
            maxValue={scale}
            label={step.label}
            valueLabel={String(step.value)}
            showLabel
          />
        ))}
      </div>
      <p className={noteCss}>{t("credit-registration-admin-funnel-no-link-fetch-step")}</p>
      <h3 className={headingCss}>{t("credit-registration-heading-suppression")}</h3>
      <p className={noteCss}>{t("credit-registration-admin-suppression-is-healthy")}</p>
      <div className={tilesCss}>
        <StatTile
          label={t("credit-registration-admin-suppressed-by-dedup")}
          value={funnel.suppressed_by_dedup_last_run}
        />
        <StatTile
          label={t("credit-registration-admin-suppressed-by-rate-cap")}
          value={funnel.suppressed_by_rate_cap_last_run}
        />
        <StatTile
          label={t("credit-registration-admin-no-address-in-registry")}
          value={funnel.no_address_in_study_registry_last_run}
        />
        <StatTile
          label={t("credit-registration-admin-waiting-for-number")}
          value={stats.waiting_for_student_number_count}
          href={`${creditRegistrationRegistrationsRoute()}${WAITING_QUERY}`}
          {...includeIf(stats.waiting_for_student_number_count > 0, { tone: ALERT_TONE })}
        />
        <StatTile label={t("credit-registration-admin-manual-links-total")} value={manualTotal} />
      </div>
    </section>
  )
}

const SendStatusSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const totals = stats.send_status_totals
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-admin-send-status-header")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-send-status-our-side-note")}</p>
      <div className={tilesCss}>
        <StatTile label={t("credit-registration-admin-send-status-queued")} value={totals.queued} />
        <StatTile
          label={t("credit-registration-admin-send-status-retrying")}
          value={totals.retrying}
        />
        <StatTile label={t("credit-registration-admin-send-status-sent")} value={totals.sent} />
        <StatTile
          label={t("credit-registration-admin-send-status-send-failed")}
          value={totals.send_failed}
          {...includeIf(totals.send_failed > 0, { tone: ALERT_TONE })}
        />
      </div>
      {stats.hard_failure_domains.length > 0 && (
        <Table
          caption={t("credit-registration-heading-failure-domains")}
          showCaption
          rowKey={(row) => row.domain}
          rows={stats.hard_failure_domains}
          columns={[
            { header: t("label-domain"), cell: (row) => <code>{row.domain}</code> },
            { header: t("label-count"), cell: (row) => row.count },
          ]}
        />
      )}
    </section>
  )
}

const RealisationSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-realisations")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-realisation-last-run-note")}</p>
      {stats.realisations.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-realisations")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-realisations")}
          rowKey={(row) => row.course_unit_realisation_id}
          rows={stats.realisations}
          columns={[
            { header: t("label-course"), cell: (row) => row.course_name },
            {
              header: t("label-credit-registration-realisation"),
              cell: (row) => <code>{row.course_unit_realisation_id}</code>,
            },
            {
              header: t("label-credit-registration-last-listed"),
              cell: (row) => <RelativeTime at={row.last_listed_at} />,
            },
            {
              header: t("credit-registration-admin-funnel-discovered"),
              cell: (row) => row.listed_person_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-funnel-already-linked"),
              cell: (row) => row.already_linked_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-funnel-mails-claimed"),
              cell: (row) => row.mailed_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-suppressed-by-dedup"),
              cell: (row) => row.suppressed_by_dedup_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-suppressed-by-rate-cap"),
              cell: (row) => row.suppressed_by_rate_cap_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-no-address-in-registry"),
              cell: (row) => row.no_address_count ?? ABSENT,
            },
          ]}
        />
      )}
    </section>
  )
}

const StaleAddressSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>
        {t("credit-registration-heading-stale-addresses", {
          max: stats.max_mails_per_person_and_course,
        })}
      </h2>
      <p className={noteCss}>{t("credit-registration-admin-stale-addresses-note")}</p>
      {stats.stale_addresses.length === 0 ? (
        <p className={noteCss}>{t("credit-registration-admin-no-stale-addresses")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-stale-addresses-table")}
          rowKey={(row) => `${row.student_number}:${row.course_id}`}
          rows={stats.stale_addresses}
          columns={[
            { header: t("label-student-number"), cell: (row) => row.student_number },
            { header: t("label-course"), cell: (row) => row.course_name },
            {
              header: t("label-credit-registration-addresses-tried"),
              cell: (row) => (
                <ul className={listCss}>
                  {row.addresses.map((address, index) => {
                    const status = row.send_statuses[index] ?? SEND_FAILED
                    return (
                      <li key={address}>
                        {address}
                        {DOT}
                        <Badge tone={status === SEND_FAILED ? WARNING_BADGE : NEUTRAL_BADGE}>
                          {sendStatusLabel(t, status)}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              ),
            },
            {
              header: t("label-credit-registration-first-sent"),
              cell: (row) => <RelativeTime at={row.first_sent_at} />,
            },
            {
              header: t("label-credit-registration-last-sent"),
              cell: (row) => <RelativeTime at={row.last_sent_at} />,
            },
            {
              header: t("label-actions"),
              cell: (row) => (
                <AdminResendLinkingEmailDialog
                  studentNumber={row.student_number}
                  courseId={row.course_id}
                  courseName={row.course_name}
                  hasMailHistory
                />
              ),
            },
          ]}
        />
      )}
    </section>
  )
}

const RecentClaimsSection: React.FC = () => {
  const { t } = useTranslation()
  const numbersQuery = useAdminVerifiedStudentNumbers({
    page: 1,
    limit: STUDENT_NUMBER_PAGE_SIZE,
  })
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-recent-claims")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-claiming-address-differs-note")}</p>
      <QueryResult query={numbersQuery}>
        {(page) =>
          page.data.length === 0 ? (
            <p className={noteCss}>{t("credit-registration-admin-no-links-yet")}</p>
          ) : (
            <Table
              caption={t("credit-registration-heading-recent-claims")}
              rowKey={(row) => row.id}
              rows={page.data}
              columns={[
                { header: t("label-student-number"), cell: (row) => row.student_number },
                {
                  header: t("label-student"),
                  cell: (row) => [row.first_name, row.last_name].filter(Boolean).join(" "),
                },
                { header: t("label-email"), cell: (row) => row.user_email ?? ABSENT },
                {
                  header: t("label-credit-registration-verified-via"),
                  cell: (row) => (
                    <Badge tone={row.verified_via === ADMIN_MANUAL ? WARNING_BADGE : SUCCESS_BADGE}>
                      {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                    </Badge>
                  ),
                },
                {
                  header: t("label-credit-registration-proof-address"),
                  cell: (row) => row.verified_via_email ?? ABSENT,
                },
                { header: t("label-time"), cell: (row) => <RelativeTime at={row.verified_at} /> },
                { header: t("label-reason"), cell: (row) => row.link_reason },
                {
                  header: t("label-actions"),
                  cell: (row) => (
                    <UnlinkButton verifiedStudentNumberId={row.id} number={row.student_number} />
                  ),
                },
              ]}
            />
          )
        }
      </QueryResult>
    </section>
  )
}

/**
 * Where account linking stands, and the two support remedies.
 *
 * The mail goes to the address the study registry holds, with no attempt to match it against an
 * account here: that mismatch is the reason the flow exists. So the funnel has no "matched to an
 * account" step, and there is no per-person record of who was discovered — an unreachable person is a
 * count, by design.
 */
const LinkingPage: React.FC = () => {
  const statsQuery = useAccountLinkingStats(WINDOW_DAYS)

  return (
    <QueryResult query={statsQuery}>
      {(stats) => (
        <div className={sectionsCss}>
          <FunnelSection stats={stats} />
          <SendStatusSection stats={stats} />
          <RealisationSection stats={stats} />
          <StaleAddressSection stats={stats} />
          <RecentClaimsSection />
        </div>
      )}
    </QueryResult>
  )
}

export default LinkingPage
