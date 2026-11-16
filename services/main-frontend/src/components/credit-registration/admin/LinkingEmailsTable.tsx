"use client"

import { cx } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AdminResendLinkingEmailDialog from "@/components/credit-registration/admin/AdminResendLinkingEmailDialog"
import LinkingEmailSendStatus from "@/components/credit-registration/admin/LinkingEmailSendStatus"
import {
  CREDIT_REGISTRATION_NS,
  DENSITY_COMPACT,
  ID_PREFIX_LENGTH,
  LINK_QUIET,
  TABLE_STACK,
} from "@/components/credit-registration/constants"
import { EmailAddress } from "@/components/credit-registration/EmailAddress"
import {
  breakAnywhereCss,
  codeValueCss,
  noteCss,
  stackedCellCss,
} from "@/components/credit-registration/styles"
import {
  sentenceWithTimestamp,
  ZonedTimestamp,
} from "@/components/credit-registration/ZonedTimestamp"
import type { AccountLinkingEmailRow } from "@/generated/api/types.generated"
import { manageUserRoute } from "@/shared-module/common/utils/routes"
import type { TableColumn } from "@/shared-module/components"
import { Link, Menu, Table } from "@/shared-module/components"

const RESEND_ITEM = "resend"
const LINK_USED_AT = "credit-registration-admin-link-used-at"
const LINK_USABLE_UNTIL = "credit-registration-admin-link-usable-until"

/** The student number, with the Sisu name under it when known. */
const StudentCell: React.FC<{ row: AccountLinkingEmailRow }> = ({ row }) => (
  <span className={stackedCellCss}>
    <span className={codeValueCss}>{row.student_number}</span>
    {row.sisu_full_name && <span className={breakAnywhereCss}>{row.sisu_full_name}</span>}
  </span>
)

/** The send status, with the last error under it when the send failed. */
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
    return (
      <span className={stackedCellCss}>
        {row.link_used_at && (
          <span>{sentenceWithTimestamp(t, LINK_USED_AT, row.link_used_at)}</span>
        )}
        {row.claimed_by_user_id && (
          <span className={noteCss}>
            <Link
              href={manageUserRoute(row.claimed_by_user_id)}
              appearance={LINK_QUIET}
              prefetch={false}
            >
              {t("credit-registration-admin-link-used-by", {
                account: row.claimed_by_email ?? row.claimed_by_user_id.slice(0, ID_PREFIX_LENGTH),
              })}
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
        courseOrTargetId={row.course_or_target_id}
        courseName={row.course_name}
      />
    </>
  )
}

interface LinkingEmailsTableProps {
  rows: AccountLinkingEmailRow[]
  emptyState: React.ReactNode
  /** Off on a page that is about one course already. */
  showsCourse: boolean
  canResend: boolean
}

/** Linking emails with where each went, when, what became of its send and of its link. */
const LinkingEmailsTable: React.FC<LinkingEmailsTableProps> = ({
  rows,
  emptyState,
  showsCourse,
  canResend,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const columns: TableColumn<AccountLinkingEmailRow>[] = [
    ...(showsCourse
      ? [
          {
            header: t("label-course"),
            grow: true,
            minWidth: "10rem",
            cell: (row: AccountLinkingEmailRow) => (
              <span className={breakAnywhereCss}>{row.course_name}</span>
            ),
          },
        ]
      : []),
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
  ]
  return (
    <Table
      caption={t("credit-registration-tab-linking-emails")}
      density={DENSITY_COMPACT}
      responsive={TABLE_STACK}
      rowKey={(row) => row.id}
      rows={rows}
      emptyState={emptyState}
      columns={columns}
    />
  )
}

export default LinkingEmailsTable
