"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  sendStatusLabel,
  verificationMethodLabel,
} from "@/components/credit-registration/admin/adminCreditRegistrationCopy"
import {
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
  useInvalidateAfterLinkingChange,
} from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminResendLinkingEmailDialog from "@/components/credit-registration/admin/AdminResendLinkingEmailDialog"
import RelativeTime, { ABSENT } from "@/components/credit-registration/admin/RelativeTime"
import { useReasonConfirmAction } from "@/components/credit-registration/admin/useReasonConfirmAction"
import { MIDDLE_DOT, TONE } from "@/components/credit-registration/constants"
import {
  headingCss,
  noteCss,
  sectionCss,
  sectionsCss,
  tilesCss,
} from "@/components/credit-registration/styles"
import { adminUnlinkStudentNumber } from "@/generated/api/sdk.generated"
import type { AccountLinkingStats, EmailSendStatus } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import { Badge, Meter, QueryResult, StatTile, Table } from "@/shared-module/components"

const WINDOW_DAYS = 30
const STUDENT_NUMBER_PAGE_SIZE = 25
// oxlint-disable-next-line i18next/no-literal-string
const WAITING_QUERY = "?state=pending_student_number"
// oxlint-disable-next-line i18next/no-literal-string
const ADMIN_MANUAL = "admin_manual"
// oxlint-disable-next-line i18next/no-literal-string
const FAST_TRACK = "email_match_fast_track"
// oxlint-disable-next-line i18next/no-literal-string
const EMPTY_SHARE = "-"
// oxlint-disable-next-line i18next/no-literal-string
const SEND_FAILED: EmailSendStatus = "send_failed"

const funnelCss = css`
  display: grid;
  gap: 0.5rem;
  max-width: 40rem;
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
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { button, dialog } = useReasonConfirmAction({
    mutationFn: (fields) =>
      adminUnlinkStudentNumber({
        path: { verified_student_number_id: verifiedStudentNumberId },
        body: { reason: fields.reason },
      }),
    // Unlinking recomputes preconditions synchronously, so registration state moves too.
    invalidate: () => void invalidateAfterLinkingChange(),
    buttonLabel: t("button-text-unlink"),
    dialogTitle: t("button-text-unlink"),
    dialogMessage: t("credit-registration-admin-unlink-warning", { number }),
  })

  return (
    <>
      {button}
      {dialog}
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
  // Its own list because it branches off `discovered` and never reaches a mail: rendering it inside
  // the steps above would read as a stage everyone passes through.
  const fastTrackSteps = [
    {
      label: t("credit-registration-admin-funnel-fast-tracked-last-run"),
      value: funnel.fast_tracked_last_run,
    },
    {
      label: t("credit-registration-admin-funnel-fast-tracked-in-window"),
      value: funnel.fast_tracked_in_window,
    },
  ]
  const fastTrackTotal =
    stats.links_total_by_method.find((row) => row.verified_via === FAST_TRACK)?.count ?? 0
  const linksTotal = stats.links_total_by_method.reduce((sum, row) => sum + row.count, 0)
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
      <h3 className={headingCss}>{t("credit-registration-heading-fast-track")}</h3>
      <p className={noteCss}>{t("credit-registration-admin-fast-track-is-a-branch-note")}</p>
      <div className={funnelCss}>
        {fastTrackSteps.map((step) => (
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
      <div className={tilesCss}>
        <StatTile
          label={t("credit-registration-admin-fast-track-share")}
          value={
            linksTotal === 0 ? EMPTY_SHARE : `${Math.round((fastTrackTotal / linksTotal) * 100)}%`
          }
        />
      </div>
      <p className={noteCss}>
        {t("credit-registration-admin-fast-track-share-note", {
          fastTracked: fastTrackTotal,
          total: linksTotal,
        })}
      </p>
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
          {...includeIf(stats.waiting_for_student_number_count > 0, { tone: TONE.ALERT })}
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
          {...includeIf(totals.send_failed > 0, { tone: TONE.ALERT })}
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
  const failingRealisationCount = stats.realisations.filter(
    (row) => row.last_listing_error !== null,
  ).length
  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-realisations")}</h2>
      <p className={noteCss}>{t("credit-registration-admin-realisation-last-run-note")}</p>
      {failingRealisationCount > 0 && (
        <p className={noteCss}>
          {t("credit-registration-admin-realisations-failing-note", {
            count: failingRealisationCount,
          })}
        </p>
      )}
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
              header: t("label-credit-registration-listing-health"),
              cell: (row) =>
                row.last_listing_error ? (
                  <>
                    <Badge tone={TONE.WARNING}>
                      {t("credit-registration-admin-listing-failing", {
                        count: row.consecutive_listing_failures,
                      })}
                    </Badge>
                    {MIDDLE_DOT}
                    <code>{row.last_listing_error}</code>
                    {MIDDLE_DOT}
                    <RelativeTime at={row.last_listing_attempted_at} />
                  </>
                ) : (
                  ABSENT
                ),
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
            {
              header: t("credit-registration-admin-funnel-fast-tracked"),
              cell: (row) => row.fast_tracked_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-no-account"),
              cell: (row) => row.fast_track_skipped_no_account_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-unverified"),
              cell: (row) => row.fast_track_skipped_unverified_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-stale"),
              cell: (row) => row.fast_track_skipped_stale_verification_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-name-mismatch"),
              cell: (row) => row.fast_track_skipped_name_mismatch_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-has-number"),
              cell: (row) => row.fast_track_skipped_account_has_number_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-fast-track-skipped-unlinked-before"),
              cell: (row) => row.fast_track_skipped_unlinked_before_count ?? ABSENT,
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
                        {MIDDLE_DOT}
                        <Badge tone={status === SEND_FAILED ? TONE.WARNING : TONE.NEUTRAL}>
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
                    <Badge tone={row.verified_via === ADMIN_MANUAL ? TONE.WARNING : TONE.SUCCESS}>
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

/** Deliberately no "matched to an account" step: that mismatch is what this flow exists to fix. */
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
