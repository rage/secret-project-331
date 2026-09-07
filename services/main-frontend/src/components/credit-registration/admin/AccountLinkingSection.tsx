"use client"

import { css, cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { adminUnlinkStudentNumber } from "@/generated/api/sdk.generated"
import type {
  AccountLinkingRealisationCounters,
  AccountLinkingStaleAddress,
  AccountLinkingStats,
  EmailSendStatus,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { includeIf } from "@/shared-module/common/utils/nullability"
import type { TableColumn } from "@/shared-module/components"
import {
  Badge,
  DescriptionList,
  Menu,
  MeterInline,
  QueryResult,
  RelativeTime,
  StatTile,
  StatTileList,
  Table,
} from "@/shared-module/components"

import {
  ABSENT,
  ALIGN_END,
  BADGE_COMPACT,
  DENSITY_COMPACT,
  QUIET_REFRESH,
  STACKED,
  TABLE_STACK,
  TIME_COMPACT,
  TONE,
} from "../constants"
import {
  headingCss,
  monospaceCss,
  noteCss,
  proseCss,
  rowCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCardsCss,
  sectionHeaderCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import { sendStatusLabel, verificationMethodLabel } from "./adminCreditRegistrationCopy"
import {
  LINKING_STATS_WINDOW_DAYS,
  useAccountLinkingStats,
  useAdminVerifiedStudentNumbers,
  useInvalidateAfterLinkingChange,
} from "./adminCreditRegistrationHooks"
import AdminManualLinkButton from "./AdminManualLinkButton"
import AdminManualLinkDialog from "./AdminManualLinkDialog"
import AdminResendLinkingEmailDialog from "./AdminResendLinkingEmailDialog"
import { formatSharePercent } from "./percent"
import StudentCell, { STUDENT_COLUMN_MIN_WIDTH } from "./StudentCell"
import { useReasonConfirmAction } from "./useReasonConfirmAction"

const CLAIMS_PER_PAGE = 25
const CLAIMS_PAGE_SIZE_OPTIONS = [25, 50, 100]
const DAY_SECS = 86_400
/** A meter needs a non-zero maximum, and a funnel whose first step is zero has nothing to scale. */
const MIN_FUNNEL_BASE = 1

const ADMIN_MANUAL = "admin_manual"
const SEND_FAILED: EmailSendStatus = "send_failed"
const RESEND_ITEM = "resend"
const LINK_BY_HAND_ITEM = "link-by-hand"

/** A step's label beside its bar, so the bars line up in a column of their own. */
const funnelStepCss = css`
  display: grid;
  gap: var(--space-1) var(--space-4);
  grid-template-columns: minmax(0, 18rem) minmax(0, 1fr);
  align-items: center;

  @media (max-width: 40rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`

const funnelCss = css`
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
`

/** Capped, so the count does not sit a screen away from the domain it belongs to. */
const narrowTableCss = css`
  max-width: 24rem;
`

const addressListCss = css`
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
`

interface FunnelStep {
  /** Also the list key: two steps of one funnel never carry the same label. */
  label: string
  value: number
  /** Set where the step is part of the first step's population rather than a route beside it. */
  isShareOfBase?: boolean
}

/**
 * One funnel as a bar list: every step against the first, so where people drop out is the shape of
 * the list rather than a number the reader has to divide.
 */
const FunnelSteps: React.FC<{ steps: readonly FunnelStep[]; base: number }> = ({ steps, base }) => (
  // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role
  <ol className={funnelCss} role="list">
    {steps.map((step) => (
      <li key={step.label} className={funnelStepCss}>
        <span>{step.label}</span>
        <MeterInline
          label={step.label}
          value={step.value}
          maxValue={Math.max(base, MIN_FUNNEL_BASE)}
          valueText={String(step.value)}
          {...includeIf(step.isShareOfBase && base > 0, {
            secondaryText: formatSharePercent(step.value, base),
          })}
        />
      </li>
    ))}
  </ol>
)

/**
 * The number true right now, not about a window: the student-number backlog. Uncarded, as the
 * page's opener — and missing its failure count on purpose, since the tab badge already flags that.
 */
const RightNow: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <StatTileList
      ariaLabel={t("credit-registration-heading-linking-right-now")}
      maxColumns={1}
      size="compact"
    >
      <StatTile
        label={t("credit-registration-admin-waiting-for-number")}
        value={stats.waiting_for_student_number_count}
      />
    </StatTileList>
  )
}

/** Where the window's mails ended up: sent, claimed, or linked without a mail at all. */
const WindowFunnel: React.FC<{ stats: AccountLinkingStats; windowDays: number }> = ({
  stats,
  windowDays,
}) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  const steps: FunnelStep[] = [
    {
      label: t("credit-registration-admin-funnel-mails-sent"),
      value: funnel.mails_sent_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-numbers-claimed"),
      value: funnel.numbers_claimed_in_window,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-funnel-fast-tracked"),
      value: funnel.fast_tracked_in_window,
    },
    {
      label: t("credit-registration-admin-funnel-manual-links"),
      value: funnel.manual_links_in_window,
    },
  ]
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-linking-window", { days: windowDays })}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-funnel-note")}</p>
      <FunnelSteps steps={steps} base={funnel.mails_sent_in_window} />
    </section>
  )
}

/**
 * The last discovery run as a funnel that adds up: every person Sisu listed either took one of the
 * branches below or was mailed, and the mails are the remainder rather than a counter of their own.
 */
const DiscoveryRun: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const funnel = stats.funnel
  const listed = funnel.persons_discovered_last_run
  const branches: FunnelStep[] = [
    {
      label: t("credit-registration-admin-funnel-already-linked"),
      value: funnel.already_linked_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-funnel-fast-tracked"),
      value: funnel.fast_tracked_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-suppressed-by-dedup"),
      value: funnel.suppressed_by_dedup_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-suppressed-by-rate-cap"),
      value: funnel.suppressed_by_rate_cap_last_run,
      isShareOfBase: true,
    },
    {
      label: t("credit-registration-admin-no-address-in-registry"),
      value: funnel.no_address_in_study_registry_last_run,
      isShareOfBase: true,
    },
  ]
  const branched = branches.reduce((sum, branch) => sum + branch.value, 0)
  const mailed = Math.max(listed - branched, 0)
  const steps =
    mailed > 0
      ? [
          ...branches,
          {
            label: t("credit-registration-admin-funnel-mailed-this-run"),
            value: mailed,
            isShareOfBase: true,
          },
        ]
      : branches
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-last-discovery-run")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-funnel-listed", { count: listed })}
        </p>
      </div>
      <FunnelSteps steps={steps} base={Math.max(listed, branched + mailed)} />
    </div>
  )
}

/** What our own sender did with the mails, and the domains it could not reach at all. */
const SendStatusBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const totals = stats.send_status_totals
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-admin-send-status-header")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-send-status-our-side-note")}
        </p>
      </div>
      <StatTileList ariaLabel={t("credit-registration-admin-send-status-header")} size="compact">
        <StatTile label={t("credit-registration-admin-send-status-queued")} value={totals.queued} />
        <StatTile
          label={t("credit-registration-admin-send-status-retrying")}
          value={totals.retrying}
        />
        <StatTile label={t("credit-registration-admin-send-status-sent")} value={totals.sent} />
        {/* Not alertWhenNonZero: the tab badge already flags this count, so it needs no second alarm here. */}
        <StatTile
          label={t("credit-registration-admin-send-status-send-failed")}
          value={totals.send_failed}
        />
      </StatTileList>
      {stats.hard_failure_domains.length > 0 && (
        <div className={subsectionCss}>
          <h4 className={subheadingCss}>{t("credit-registration-heading-failure-domains")}</h4>
          <Table
            className={narrowTableCss}
            caption={t("credit-registration-heading-failure-domains")}
            density={DENSITY_COMPACT}
            rowKey={(row) => row.domain}
            rows={stats.hard_failure_domains}
            columns={[
              { header: t("label-domain"), grow: true, cell: (row) => <code>{row.domain}</code> },
              {
                header: t("label-count"),
                align: ALIGN_END,
                nowrap: true,
                cell: (row) => row.count,
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

/** Why listed people got no mail on this realisation's last run; a counter of zero says nothing. */
const RealisationBreakdown: React.FC<{ row: AccountLinkingRealisationCounters }> = ({ row }) => {
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
    { label: t("credit-registration-admin-no-address-in-registry"), value: row.no_address_count },
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
  const nonZero = counters.filter((counter) => (counter.value ?? 0) > 0)
  if (nonZero.length === 0) {
    return <p className={noteCss}>{t("credit-registration-admin-nothing-held-a-mail-back")}</p>
  }
  return (
    <DescriptionList
      layout={STACKED}
      items={nonZero.map((counter) => ({ label: counter.label, value: counter.value ?? ABSENT }))}
    />
  )
}

const RealisationBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <div className={subsectionCss}>
      <div className={sectionHeaderCss}>
        <h3 className={subheadingCss}>{t("credit-registration-heading-realisations")}</h3>
        <p className={cx(noteCss, proseCss)}>
          {t("credit-registration-admin-realisation-last-run-note")}
        </p>
      </div>
      <Table
        caption={t("credit-registration-heading-realisations")}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => row.course_unit_realisation_id}
        rows={stats.realisations}
        emptyState={t("credit-registration-admin-no-realisations")}
        expandableRow={(row) => <RealisationBreakdown row={row} />}
        columns={[
          {
            header: t("label-course"),
            grow: true,
            minWidth: "14rem",
            cell: (row) => (
              <span className={stackedCellCss}>
                <span>{row.course_name}</span>
                <span className={cx(noteCss, monospaceCss)}>{row.uh_course_code}</span>
              </span>
            ),
          },
          {
            // Nothing when the listing works: a badge on every row is a badge nobody reads.
            header: t("label-credit-registration-listing-health"),
            minWidth: "10rem",
            cell: (row) =>
              row.last_listing_error ? (
                <span className={stackedCellCss}>
                  <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
                    {t("credit-registration-admin-listing-failing", {
                      count: row.consecutive_listing_failures,
                    })}
                  </Badge>
                  <span className={noteCss}>{row.last_listing_error}</span>
                </span>
              ) : null,
          },
          {
            header: t("label-credit-registration-last-listed"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.last_listed_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("credit-registration-admin-funnel-discovered"),
            align: ALIGN_END,
            minWidth: "7rem",
            nowrap: false,
            cell: (row) => row.listed_person_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-funnel-mails-claimed"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: false,
            cell: (row) => row.mailed_count ?? ABSENT,
          },
          {
            header: t("credit-registration-admin-funnel-fast-tracked"),
            align: ALIGN_END,
            minWidth: "6rem",
            nowrap: false,
            cell: (row) => row.fast_tracked_count ?? ABSENT,
          },
        ]}
      />
    </div>
  )
}

/** Both remedies for one stale row, out of the row's way until they are asked for. */
const StaleAddressActions: React.FC<{ row: AccountLinkingStaleAddress }> = ({ row }) => {
  const { t } = useTranslation()
  const [isResendOpen, setResendOpen] = useState(false)
  const [isLinkOpen, setLinkOpen] = useState(false)
  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-row-actions", { student: row.student_number })}
        items={[
          {
            key: RESEND_ITEM,
            label: t("button-text-resend-linking-email"),
            onAction: () => setResendOpen(true),
          },
          {
            key: LINK_BY_HAND_ITEM,
            label: t("credit-registration-admin-manual-link-title"),
            onAction: () => setLinkOpen(true),
          },
        ]}
      />
      <AdminResendLinkingEmailDialog
        open={isResendOpen}
        onClose={() => setResendOpen(false)}
        studentNumber={row.student_number}
        courseId={row.course_id}
        courseName={row.course_name}
      />
      {isLinkOpen && (
        <AdminManualLinkDialog
          open
          onClose={() => setLinkOpen(false)}
          studentNumber={row.student_number}
        />
      )}
    </>
  )
}

/** The addresses one person's mails went to, kept off the row until the reader asks for them. */
const StaleAddressSends: React.FC<{ row: AccountLinkingStaleAddress }> = ({ row }) => {
  const { t } = useTranslation()
  return (
    // oxlint-disable-next-line jsx-a11y/no-redundant-roles -- list-style: none makes VoiceOver drop the implicit list role
    <ul className={addressListCss} role="list">
      {row.sends.map((send, index) => (
        <li key={`${send.address}:${index}`} className={rowCss}>
          <span>{send.address}</span>
          {/* Only the failed send is an exception worth a pill; a sent or queued one is routine. */}
          {send.send_status === SEND_FAILED ? (
            <Badge tone={TONE.DANGER} size={BADGE_COMPACT}>
              {sendStatusLabel(t, send.send_status)}
            </Badge>
          ) : (
            <span className={noteCss}>{sendStatusLabel(t, send.send_status)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** The people mail cannot reach, one line each: the work list this page exists for. */
const StaleAddressBlock: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const addressSummary = (row: AccountLinkingStaleAddress): string => {
    const addressCount = new Set(row.sends.map((send) => send.address)).size
    return row.sends.some((send) => send.send_status === SEND_FAILED)
      ? t("credit-registration-admin-addresses-sending-failed", { count: addressCount })
      : t("credit-registration-admin-addresses-all-sent", { count: addressCount })
  }
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>
          {t("credit-registration-heading-stale-addresses", {
            max: stats.max_mails_per_person_and_course,
          })}
        </h2>
      </div>
      <p className={cx(noteCss, proseCss)}>{t("credit-registration-admin-stale-addresses-note")}</p>
      <Table
        caption={t("credit-registration-heading-stale-addresses", {
          max: stats.max_mails_per_person_and_course,
        })}
        density={DENSITY_COMPACT}
        responsive={TABLE_STACK}
        rowKey={(row) => `${row.student_number}:${row.course_id}`}
        rows={stats.stale_addresses}
        emptyState={t("credit-registration-admin-no-stale-addresses")}
        expandableRow={(row) => <StaleAddressSends row={row} />}
        columns={[
          {
            header: t("label-student-number"),
            minWidth: "7rem",
            nowrap: true,
            cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
          },
          {
            header: t("label-course"),
            grow: true,
            minWidth: "12rem",
            cell: (row) => row.course_name,
          },
          {
            header: t("label-credit-registration-addresses-tried"),
            minWidth: "10rem",
            cell: (row) => addressSummary(row),
          },
          {
            header: t("label-credit-registration-last-sent"),
            minWidth: "8rem",
            nowrap: true,
            cell: (row) => <RelativeTime at={row.last_sent_at} absoluteTime={TIME_COMPACT} />,
          },
          {
            header: t("label-actions"),
            minWidth: "5rem",
            cell: (row) => <StaleAddressActions row={row} />,
          },
        ]}
      />
      <div className={rowCss}>
        <AdminManualLinkButton />
      </div>
    </section>
  )
}

const UnlinkAction: React.FC<{ verifiedStudentNumberId: string; number: string }> = ({
  verifiedStudentNumberId,
  number,
}) => {
  const { t } = useTranslation()
  const invalidateAfterLinkingChange = useInvalidateAfterLinkingChange()
  const { item, dialog } = useReasonConfirmAction({
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
    isDestructive: true,
  })

  return (
    <>
      <Menu
        aria-label={t("credit-registration-admin-row-actions", { student: number })}
        items={[item]}
      />
      {dialog}
    </>
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
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-claiming-address-differs-note")}
      </p>
      <QueryResult
        query={numbersQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={subsectionCss}
      >
        {(page) => {
          // Only manual links carry one, so on most pages the column would be empty end to end.
          const reasonColumn: TableColumn<(typeof page.data)[number]>[] = page.data.some(
            (row) => row.link_reason,
          )
            ? [
                {
                  header: t("label-reason"),
                  grow: true,
                  minWidth: "14rem",
                  nowrap: false,
                  cell: (row) => row.link_reason ?? ABSENT,
                },
              ]
            : []
          return (
            <>
              <Table
                caption={t("credit-registration-heading-recent-claims")}
                density={DENSITY_COMPACT}
                responsive={TABLE_STACK}
                rowKey={(row) => row.id}
                rows={page.data}
                emptyState={t("credit-registration-admin-no-links-yet")}
                columns={[
                  {
                    header: t("label-student-number"),
                    minWidth: "7rem",
                    nowrap: true,
                    cell: (row) => <span className={monospaceCss}>{row.student_number}</span>,
                  },
                  {
                    header: t("label-student"),
                    grow: reasonColumn.length === 0,
                    minWidth: STUDENT_COLUMN_MIN_WIDTH,
                    cell: (row) => <StudentCell row={{ ...row, email: row.user_email ?? null }} />,
                  },
                  {
                    header: t("label-credit-registration-verified-via"),
                    minWidth: "12rem",
                    cell: (row) => (
                      <span className={stackedCellCss}>
                        {/* A pill only for the exception: an admin having to link by hand, not the two
                            self-service routes a claim normally takes. */}
                        {row.verified_via === ADMIN_MANUAL ? (
                          <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
                            {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                          </Badge>
                        ) : (
                          <span>
                            {verificationMethodLabel(t, row.verified_via) ?? row.verified_via}
                          </span>
                        )}
                        <span className={noteCss}>{row.verified_via_email}</span>
                      </span>
                    ),
                  },
                  {
                    header: t("label-time"),
                    minWidth: "8rem",
                    nowrap: true,
                    cell: (row) => (
                      <RelativeTime at={row.verified_at} absoluteTime={TIME_COMPACT} />
                    ),
                  },
                  ...reasonColumn,
                  {
                    header: t("label-actions"),
                    minWidth: "5rem",
                    cell: (row) => (
                      <UnlinkAction verifiedStudentNumberId={row.id} number={row.student_number} />
                    ),
                  },
                ]}
              />
              <Pagination
                paginationInfo={paginationInfo}
                totalPages={page.total_pages}
                totalItems={page.total_count}
                itemsPerPageOptions={CLAIMS_PAGE_SIZE_OPTIONS}
              />
            </>
          )
        }}
      </QueryResult>
    </div>
  )
}

/** What our sender did with the mails, the last discovery run, and per-realisation counters: diagnostics for the funnel above. */
const LinkingDetailsSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-linking-details")}</h2>
      </div>
      <SendStatusBlock stats={stats} />
      <DiscoveryRun stats={stats} />
      <RealisationBlock stats={stats} />
    </section>
  )
}

const RecentClaimsSection: React.FC<{ stats: AccountLinkingStats }> = ({ stats }) => {
  const { t } = useTranslation()
  const manualLinkTotal =
    stats.links_total_by_method.find((row) => row.verified_via === ADMIN_MANUAL)?.count ?? 0
  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-heading-recent-claims")}</h2>
      </div>
      <p className={cx(noteCss, proseCss)}>
        {t("credit-registration-admin-manual-links-total-count", { count: manualLinkTotal })}
      </p>
      <RecentClaimsBlock />
    </section>
  )
}

/** How a student number reaches an account, and who is stuck on the way. */
const AccountLinkingSection: React.FC = () => {
  const statsQuery = useAccountLinkingStats(LINKING_STATS_WINDOW_DAYS)

  return (
    <QueryResult
      query={statsQuery}
      refreshIndicator={QUIET_REFRESH}
      contentClassName={sectionCardsCss}
    >
      {(stats) => {
        // From the response, not the request: the endpoint decides what window it measured.
        const windowDays = Math.round(stats.window_secs / DAY_SECS)
        return (
          <>
            <RightNow stats={stats} />
            <WindowFunnel stats={stats} windowDays={windowDays} />
            <StaleAddressBlock stats={stats} />
            <LinkingDetailsSection stats={stats} />
            <RecentClaimsSection stats={stats} />
          </>
        )
      }}
    </QueryResult>
  )
}

export default AccountLinkingSection
