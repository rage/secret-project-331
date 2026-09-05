"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { adminUnlinkStudentNumber } from "@/generated/api/sdk.generated"
import type {
  AccountLinkingRealisationCounters,
  AccountLinkingStats,
  EmailSendStatus,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { creditRegistrationRegistrationsRoute } from "@/shared-module/common/utils/routes"
import {
  Badge,
  DescriptionList,
  Disclosure,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  MIDDLE_DOT,
  QUIET_REFRESH,
  STACKED,
  TIME_IN_TITLE,
  TONE,
} from "../constants"
import {
  emptyStateCss,
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import { sendStatusLabel, verificationMethodLabel } from "./adminCreditRegistrationCopy"
import {
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
  useInvalidateAfterLinkingChange,
} from "./adminCreditRegistrationHooks"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

const WINDOW_DAYS = 30
const CLAIMS_PER_PAGE = 25
const PERCENT = 100

// oxlint-disable-next-line i18next/no-literal-string
const WAITING_QUERY = "?state=pending"
// oxlint-disable-next-line i18next/no-literal-string
const ADMIN_MANUAL = "admin_manual"
// oxlint-disable-next-line i18next/no-literal-string
const FAST_TRACK = "email_match_fast_track"
// oxlint-disable-next-line i18next/no-literal-string
const SEND_FAILED: EmailSendStatus = "send_failed"

const addressListCss = css`
  margin: 0;
  padding-inline-start: var(--space-4);
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

/**
 * Where the last discovery run's persons went. Only counts from that one run belong here; anything
 * measured over the window is a tile above instead.
 */
const DiscoverySteps: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
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
      label: t("credit-registration-admin-funnel-fast-tracked-last-run"),
      value: funnel.fast_tracked_last_run,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: funnel.suppressed_by_dedup_last_run,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: funnel.suppressed_by_rate_cap_last_run,
    },
    {
      label: t("credit-registration-admin-no-address-in-registry"),
      value: funnel.no_address_in_study_registry_last_run,
    },
  ]
  return <DescriptionList className={proseCss} items={steps} />
}

const WindowTotals: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  const fastTrackTotal =
    stats.links_total_by_method.find((row) => row.verified_via === FAST_TRACK)?.count ?? 0
  const manualTotal =
    stats.links_total_by_method.find((row) => row.verified_via === ADMIN_MANUAL)?.count ?? 0
  const linksTotal = stats.links_total_by_method.reduce((sum, row) => sum + row.count, 0)
  return (
    <StatTileList
      ariaLabel={t("credit-registration-heading-linking-in-window", { days: WINDOW_DAYS })}
    >
      <StatTile
        label={t("credit-registration-admin-funnel-mails-sent")}
        value={funnel.mails_sent_in_window}
      />
      <StatTile
        label={t("credit-registration-admin-funnel-numbers-claimed")}
        value={funnel.numbers_claimed_in_window}
      />
      <StatTile
        label={t("credit-registration-admin-funnel-fast-tracked-in-window")}
        value={funnel.fast_tracked_in_window}
      />
      <StatTile
        label={t("credit-registration-admin-funnel-manual-links")}
        value={funnel.manual_links_in_window}
      />
      {linksTotal > 0 && (
        <StatTile
          label={t("credit-registration-admin-fast-track-share")}
          value={`${Math.round((fastTrackTotal / linksTotal) * PERCENT)} %`}
        />
      )}
      <StatTile label={t("credit-registration-admin-manual-links-total")} value={manualTotal} />
      <StatTile
        label={t("credit-registration-admin-waiting-for-number")}
        value={stats.waiting_for_student_number_count}
        href={`${creditRegistrationRegistrationsRoute()}${WAITING_QUERY}`}
        {...includeIf(stats.waiting_for_student_number_count > 0, { tone: TONE.ALERT })}
      />
    </StatTileList>
  )
}

const SendStatusBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const totals = stats.send_status_totals
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>{t("credit-registration-admin-send-status-header")}</h3>
      <p className={noteCss}>{t("credit-registration-admin-send-status-our-side-note")}</p>
      <StatTileList ariaLabel={t("credit-registration-admin-send-status-header")}>
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
      </StatTileList>
      {stats.hard_failure_domains.length > 0 && (
        <Table
          caption={t("credit-registration-heading-failure-domains")}
          showCaption
          rowKey={(row) => row.domain}
          rows={stats.hard_failure_domains}
          columns={[
            { header: t("label-domain"), cell: (row) => <code>{row.domain}</code> },
            { header: t("label-count"), align: ALIGN_END, cell: (row) => row.count },
          ]}
        />
      )}
    </div>
  )
}

const RealisationDetail: React.FC<{ row: AccountLinkingRealisationCounters }> = ({ row }) => {
  const { t } = useTranslation()
  const counters: { label: string; value: number | null | undefined }[] = [
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: row.already_linked_count,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: row.suppressed_by_dedup_count,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: row.suppressed_by_rate_cap_count,
    },
    {
      label: t("credit-registration-admin-no-address-in-registry"),
      value: row.no_address_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-no-account"),
      value: row.fast_track_skipped_no_account_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-unverified"),
      value: row.fast_track_skipped_unverified_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-stale"),
      value: row.fast_track_skipped_stale_verification_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-name-mismatch"),
      value: row.fast_track_skipped_name_mismatch_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-has-number"),
      value: row.fast_track_skipped_account_has_number_count,
    },
    {
      label: t("credit-registration-admin-fast-track-skipped-unlinked-before"),
      value: row.fast_track_skipped_unlinked_before_count,
    },
  ]
  return (
    <Disclosure title={t("credit-registration-admin-why-no-mail")}>
      <DescriptionList
        layout={STACKED}
        items={counters.map((counter) => ({
          label: counter.label,
          value: counter.value ?? ABSENT,
        }))}
      />
    </Disclosure>
  )
}

const RealisationBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>{t("credit-registration-heading-realisations")}</h3>
      <p className={noteCss}>{t("credit-registration-admin-realisation-last-run-note")}</p>
      {stats.realisations.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-realisations")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-realisations")}
          rowKey={(row) => row.course_unit_realisation_id}
          rows={stats.realisations}
          columns={[
            {
              header: t("label-course"),
              cell: (row) => (
                <span className={stackedCellCss}>
                  <span>{row.course_name}</span>
                  <span className={cx(noteCss, monospaceCss)}>{row.uh_course_code}</span>
                </span>
              ),
            },
            {
              header: t("label-credit-registration-listing-health"),
              cell: (row) =>
                row.last_listing_error ? (
                  <span className={stackedCellCss}>
                    <Badge tone={TONE.DANGER}>
                      {t("credit-registration-admin-listing-failing", {
                        count: row.consecutive_listing_failures,
                      })}
                    </Badge>
                    <span className={noteCss}>{row.last_listing_error}</span>
                  </span>
                ) : (
                  <Badge tone={TONE.SUCCESS}>{t("credit-registration-admin-listing-ok")}</Badge>
                ),
            },
            {
              header: t("label-credit-registration-last-listed"),
              cell: (row) => <RelativeTime at={row.last_listed_at} absoluteTime={TIME_IN_TITLE} />,
            },
            {
              header: t("credit-registration-admin-funnel-discovered"),
              align: ALIGN_END,
              cell: (row) => row.listed_person_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-funnel-mails-claimed"),
              align: ALIGN_END,
              cell: (row) => row.mailed_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-funnel-fast-tracked"),
              align: ALIGN_END,
              cell: (row) => row.fast_tracked_count ?? ABSENT,
            },
            {
              header: t("credit-registration-admin-column-breakdown"),
              cell: (row) => <RealisationDetail row={row} />,
            },
          ]}
        />
      )}
    </div>
  )
}

const StaleAddressBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>
        {t("credit-registration-heading-stale-addresses", {
          max: stats.max_mails_per_person_and_course,
        })}
      </h3>
      <p className={noteCss}>{t("credit-registration-admin-stale-addresses-note")}</p>
      <div className={rowCss}>
        <AdminManualLinkButton />
      </div>
      {stats.stale_addresses.length === 0 ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-stale-addresses")}</p>
      ) : (
        <Table
          caption={t("credit-registration-heading-stale-addresses-table")}
          rowKey={(row) => `${row.student_number}:${row.course_id}`}
          rows={stats.stale_addresses}
          columns={[
            {
              header: t("label-student-number"),
              cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
            },
            { header: t("label-course"), cell: (row) => row.course_name },
            {
              header: t("label-credit-registration-addresses-tried"),
              cell: (row) => (
                <ul className={addressListCss}>
                  {row.sends.map((send) => (
                    <li key={send.address}>
                      {send.address}
                      {MIDDLE_DOT}
                      <Badge tone={send.send_status === SEND_FAILED ? TONE.DANGER : TONE.NEUTRAL}>
                        {sendStatusLabel(t, send.send_status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              header: t("label-credit-registration-last-sent"),
              cell: (row) => <RelativeTime at={row.last_sent_at} absoluteTime={TIME_IN_TITLE} />,
            },
            {
              header: t("label-actions"),
              cell: (row) => (
                <AdminResendLinkingEmailDialog
                  studentNumber={row.student_number}
                  courseId={row.course_id}
                  courseName={row.course_name}
                />
              ),
            },
          ]}
        />
      )}
    </div>
  )
}

const RecentClaimsBlock: React.FC = () => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo(CLAIMS_PER_PAGE)
  const numbersQuery = useAdminVerifiedStudentNumbers({
    page: paginationInfo.page,
    limit: paginationInfo.limit,
  })
  return (
    <div className={subsectionCss}>
      <h3 className={subheadingCss}>{t("credit-registration-heading-recent-claims")}</h3>
      <p className={noteCss}>{t("credit-registration-admin-claiming-address-differs-note")}</p>
      <QueryResult query={numbersQuery} refreshIndicator={QUIET_REFRESH}>
        {(page) =>
          page.data.length === 0 ? (
            <p className={emptyStateCss}>{t("credit-registration-admin-no-links-yet")}</p>
          ) : (
            <>
              <Table
                caption={t("credit-registration-heading-recent-claims")}
                rowKey={(row) => row.id}
                rows={page.data}
                columns={[
                  {
                    header: t("label-student-number"),
                    cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
                  },
                  {
                    header: t("label-student"),
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <span>{[row.first_name, row.last_name].filter(Boolean).join(" ")}</span>
                        <span className={noteCss}>{row.user_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-credit-registration-verified-via"),
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        <Badge
                          tone={row.verified_via === ADMIN_MANUAL ? TONE.NEUTRAL : TONE.SUCCESS}
                        >
                          {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                        </Badge>
                        <span className={noteCss}>{row.verified_via_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-time"),
                    cell: (row) => (
                      <RelativeTime at={row.verified_at} absoluteTime={TIME_IN_TITLE} />
                    ),
                  },
                  { header: t("label-reason"), cell: (row) => row.link_reason },
                  {
                    header: t("label-actions"),
                    cell: (row) => (
                      <UnlinkButton verifiedStudentNumberId={row.id} number={row.student_number} />
                    ),
                  },
                ]}
              />
              <Pagination paginationInfo={paginationInfo} totalPages={page.total_pages} />
            </>
          )
        }
      </QueryResult>
    </div>
  )
}

/** How a student number reaches an account, and who is stuck on the way. */
const AccountLinkingSection: React.FC = () => {
  const { t } = useTranslation()
  const statsQuery = useAccountLinkingStats(WINDOW_DAYS)

  return (
    <section className={sectionCss}>
      <h2 className={headingCss}>{t("credit-registration-heading-linking-funnel")}</h2>
      <QueryResult query={statsQuery} refreshIndicator={QUIET_REFRESH}>
        {(stats) => (
          <>
            <WindowTotals stats={stats} />
            <div className={subsectionCss}>
              <h3 className={subheadingCss}>
                {t("credit-registration-heading-last-discovery-run")}
              </h3>
              <DiscoverySteps stats={stats} />
            </div>
            <SendStatusBlock stats={stats} />
            <RealisationBlock stats={stats} />
            <StaleAddressBlock stats={stats} />
          </>
        )}
      </QueryResult>
      <RecentClaimsBlock />
    </section>
  )
}

export default AccountLinkingSection
