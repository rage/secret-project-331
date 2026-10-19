"use client"

import { css, cx } from "@emotion/css"
import { MagnifyingGlass } from "@vectopus/atlas-icons-react"
import React, { useEffect, useId, useState } from "react"
import type { Key } from "react-aria"
import { useTranslation } from "react-i18next"

import { useAccountLinkingEmails } from "@/components/credit-registration/admin/adminCreditRegistrationHooks"
import AdminResendLinkingEmailDialog from "@/components/credit-registration/admin/AdminResendLinkingEmailDialog"
import LinkingEmailSendStatus from "@/components/credit-registration/admin/LinkingEmailSendStatus"
import { useFilteredAdminQuery } from "@/components/credit-registration/admin/useFilteredAdminQuery"
import {
  ADMIN_PAGE_SIZE_OPTIONS,
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  type CreditRegistrationTFunction,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  LINK_QUIET,
  QUIET_REFRESH,
  TABLE_STACK,
} from "@/components/credit-registration/constants"
import { EmailAddress } from "@/components/credit-registration/EmailAddress"
import {
  breakAnywhereCss,
  codeValueCss,
  controlsCss,
  headingCss,
  noteCss,
  sectionCardCss,
  sectionCardHeaderCss,
  sectionCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import { useIsAccountLinkingEnabled } from "@/components/credit-registration/useIsAccountLinkingEnabled"
import {
  sentenceWithTimestamp,
  ZonedTimestamp,
} from "@/components/credit-registration/ZonedTimestamp"
import type {
  AccountLinkingEmailRow,
  LinkingEmailListStatus,
} from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  EmptyState,
  Link,
  Menu,
  Pagination,
  QueryResult,
  Table,
  TextField,
  ToggleButtonGroup,
  ToggleButtonGroupButton,
} from "@/shared-module/components"

const ROWS_PER_PAGE = 50
const SEARCH_ICON_SIZE = 16
const RESEND_ITEM = "resend"
const LINK_USED_AT = "credit-registration-admin-link-used-at"
const LINK_USABLE_UNTIL = "credit-registration-admin-link-usable-until"

const PARAM_STATUS = "status"
const PARAM_ADDRESS = "address"

const STATUS_ALL = "all"
type StatusChoice = LinkingEmailListStatus | typeof STATUS_ALL
/** Left out of the URL, so the tab's plain link opens on it. */
const DEFAULT_STATUS: StatusChoice = "unused"
const STATUS_CHOICES: StatusChoice[] = ["unused", "used", "expired", "not_sent", STATUS_ALL]

const STATUS_LABEL_KEYS = {
  unused: "credit-registration-admin-linking-email-status-unused",
  used: "credit-registration-admin-linking-email-status-used",
  expired: "credit-registration-admin-linking-email-status-expired",
  not_sent: "credit-registration-admin-linking-email-status-not-sent",
  all: "credit-registration-admin-linking-email-status-all",
} as const satisfies Record<StatusChoice, string>

const statusLabel = (t: CreditRegistrationTFunction, status: StatusChoice): string =>
  t(STATUS_LABEL_KEYS[status])

const statusFromParam = (raw: string | undefined): StatusChoice =>
  STATUS_CHOICES.find((choice) => choice === raw) ?? DEFAULT_STATUS

const searchCss = css`
  min-width: min(20rem, 100%);
  flex: 1 1 20rem;
`

const statusFilterCss = css`
  display: grid;
  gap: var(--space-2);
`

interface FilterFields {
  address: string
  status: Set<Key>
}

/** The student number over the name Sisu gave for it. */
const StudentCell: React.FC<{ row: AccountLinkingEmailRow }> = ({ row }) => (
  <span className={stackedCellCss}>
    <span className={codeValueCss}>{row.student_number}</span>
    {row.sisu_full_name && <span className={breakAnywhereCss}>{row.sisu_full_name}</span>}
  </span>
)

/** Where the send stands, with the newest delivery error under it. */
const SendCell: React.FC<{ row: AccountLinkingEmailRow }> = ({ row }) => (
  <span className={stackedCellCss}>
    <LinkingEmailSendStatus report={row.send_status} />
    {row.last_error_message && (
      <span className={cx(noteCss, codeValueCss)}>{row.last_error_message}</span>
    )}
  </span>
)

/** Whether the link still works, and if it was used, when and by which account. */
const LinkCell: React.FC<{ row: AccountLinkingEmailRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  if (row.link_state === "used") {
    const account =
      row.claimed_by_email ?? row.claimed_by_user_id?.slice(0, ID_PREFIX_LENGTH) ?? null
    return (
      <span className={stackedCellCss}>
        <span>
          {row.link_used_at
            ? sentenceWithTimestamp(t, LINK_USED_AT, row.link_used_at)
            : t("credit-registration-admin-linking-email-status-used")}
        </span>
        {account && row.claimed_by_user_id && (
          <span className={noteCss}>
            <Link
              href={manageUserRoute(row.claimed_by_user_id)}
              appearance={LINK_QUIET}
              prefetch={false}
            >
              {t("credit-registration-admin-link-used-by", { account })}
            </Link>
          </span>
        )}
      </span>
    )
  }
  if (row.link_state === "lapsed") {
    return <span>{t("credit-registration-admin-link-expired")}</span>
  }
  return row.link_expires_at ? (
    <span>{sentenceWithTimestamp(t, LINK_USABLE_UNTIL, row.link_expires_at)}</span>
  ) : (
    <span className={noteCss}>{t("credit-registration-admin-link-none")}</span>
  )
}

/** The row's resend, out of the row's way until it is asked for. */
const ResendAction: React.FC<{ row: AccountLinkingEmailRow }> = ({ row }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [isResendOpen, setResendOpen] = useState(false)
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
        ]}
      />
      <AdminResendLinkingEmailDialog
        isOpen={isResendOpen}
        onClose={() => setResendOpen(false)}
        studentNumber={row.student_number}
        courseId={row.course_id}
        courseName={row.course_name}
      />
    </>
  )
}

/**
 * Every linking email ever queued, replaced ones too, newest first. An address search looks
 * through every status, so support finds a student's mail whatever became of it.
 */
const LinkingEmailsPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const statusLabelId = useId()
  const canResend = useIsAccountLinkingEnabled()

  const { control, watch, setValue, handleSubmit, param, applyParams, paginationInfo, query } =
    useFilteredAdminQuery<FilterFields, NonNullable<Parameters<typeof useAccountLinkingEmails>[0]>>(
      [],
      (filters, pagination) => {
        const address = filters.param(PARAM_ADDRESS)
        const status = statusFromParam(filters.param(PARAM_STATUS))
        return {
          page: pagination.page,
          limit: pagination.limit,
          ...(address
            ? { address }
            : includeIf(status !== STATUS_ALL, { status: status as LinkingEmailListStatus })),
        }
      },
      {
        rowsPerPage: ROWS_PER_PAGE,
        manualDefaults: (filters) => ({
          address: filters.param(PARAM_ADDRESS) ?? "",
          status: new Set<Key>([statusFromParam(filters.param(PARAM_STATUS))]),
        }),
      },
    )

  const searchedAddress = param(PARAM_ADDRESS)
  const urlStatus = statusFromParam(param(PARAM_STATUS))
  const pickedStatus = statusFromParam([...watch("status")][0]?.toString())

  // Back, or a pasted link, moves the toggle.
  useEffect(() => {
    setValue("status", new Set<Key>([urlStatus]))
  }, [setValue, urlStatus])

  // Keyed on the pick alone: also reacting to the URL would push the old pick back over a Back.
  useEffect(() => {
    if (pickedStatus !== urlStatus) {
      applyParams({ [PARAM_STATUS]: pickedStatus === DEFAULT_STATUS ? undefined : pickedStatus })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedStatus])

  const clearSearch = () => {
    setValue("address", "")
    applyParams({ [PARAM_ADDRESS]: undefined })
  }

  const emailsQuery = useAccountLinkingEmails(query)

  return (
    <section className={sectionCardCss}>
      <div className={sectionCardHeaderCss}>
        <h2 className={headingCss}>{t("credit-registration-tab-linking-emails")}</h2>
      </div>
      <form
        className={controlsCss}
        onSubmit={handleSubmit((fields) => applyParams({ [PARAM_ADDRESS]: fields.address.trim() }))}
      >
        <div className={searchCss}>
          <TextField
            name="address"
            control={control}
            label={t("credit-registration-admin-linking-email-search-label")}
            description={t("credit-registration-admin-linking-email-search-description")}
            iconEnd={<MagnifyingGlass size={SEARCH_ICON_SIZE} />}
          />
        </div>
      </form>
      <div className={statusFilterCss}>
        <span id={statusLabelId} className={noteCss}>
          {t("credit-registration-admin-linking-email-status")}
        </span>
        <ToggleButtonGroup
          name="status"
          control={control}
          label={null}
          aria-labelledby={statusLabelId}
          isDisabled={searchedAddress !== undefined}
        >
          {STATUS_CHOICES.map((choice) => (
            <ToggleButtonGroupButton key={choice} id={choice}>
              {statusLabel(t, choice)}
            </ToggleButtonGroupButton>
          ))}
        </ToggleButtonGroup>
        {searchedAddress !== undefined && (
          <span className={noteCss}>
            {t("credit-registration-admin-linking-email-search-all-statuses")}
          </span>
        )}
      </div>
      <QueryResult
        query={emailsQuery}
        refreshIndicator={QUIET_REFRESH}
        contentClassName={sectionCss}
      >
        {(page) => (
          <>
            {/* `Pagination` repeats this total from 2 pages on. */}
            {page.total_pages < 2 && page.total_count > 0 && (
              <p className={noteCss}>
                {t("credit-registration-admin-linking-email-count", { count: page.total_count })}
              </p>
            )}
            <Table
              caption={t("credit-registration-tab-linking-emails")}
              density={DENSITY_COMPACT}
              responsive={TABLE_STACK}
              rowKey={(row) => row.id}
              rows={page.data}
              emptyState={
                <EmptyState
                  title={t("credit-registration-admin-no-matching-linking-emails")}
                  {...includeIf(searchedAddress !== undefined, {
                    action: (
                      <Button variant={BUTTON_TERTIARY} size="small" onClick={clearSearch}>
                        {t("credit-registration-admin-clear-search")}
                      </Button>
                    ),
                  })}
                />
              }
              columns={[
                {
                  header: t("label-course"),
                  grow: true,
                  minWidth: "10rem",
                  cell: (row) => <span className={breakAnywhereCss}>{row.course_name}</span>,
                },
                {
                  header: t("credit-registration-admin-column-sent-to"),
                  minWidth: "12rem",
                  cell: (row) => <EmailAddress address={row.emailed_to} />,
                },
                {
                  header: t("credit-registration-admin-column-sent"),
                  minWidth: "7rem",
                  nowrap: true,
                  cell: (row) => <ZonedTimestamp at={row.claimed_at} />,
                },
                {
                  header: t("label-student"),
                  minWidth: "9rem",
                  cell: (row) => <StudentCell row={row} />,
                },
                {
                  header: t("credit-registration-admin-send-status-header"),
                  minWidth: "10rem",
                  nowrap: false,
                  cell: (row) => <SendCell row={row} />,
                },
                {
                  header: t("credit-registration-admin-column-link"),
                  minWidth: "10rem",
                  cell: (row) => <LinkCell row={row} />,
                },
                ...(canResend
                  ? [
                      {
                        header: t("label-actions"),
                        minWidth: "5rem",
                        cell: (row: AccountLinkingEmailRow) => <ResendAction row={row} />,
                      },
                    ]
                  : []),
              ]}
            />
            <Pagination
              page={paginationInfo.page}
              onPageChange={paginationInfo.setPage}
              itemsPerPage={paginationInfo.limit}
              onItemsPerPageChange={paginationInfo.setLimit}
              totalPages={page.total_pages}
              totalItems={page.total_count}
              itemsPerPageOptions={ADMIN_PAGE_SIZE_OPTIONS}
            />
          </>
        )}
      </QueryResult>
    </section>
  )
}

export default LinkingEmailsPage
