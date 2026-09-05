"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getSuotarApiCallOptions } from "@/generated/api/@tanstack/react-query.generated"
import { creditRegistrationItemRoute } from "@/shared-module/common/utils/routes"
import {
  Button,
  CopyButton,
  Dialog,
  QueryResult,
  RelativeTime,
  RELATIVE_TIME_ABSENT_LABEL,
  Table,
} from "@/shared-module/components"

import { TIME_IN_TITLE } from "../constants"
import { headingCss, noteCss } from "../styles"
import { eventKindLabel } from "./adminCreditRegistrationCopy"
import AdminStateBadge from "./AdminStateBadge"

interface Props {
  suotarApiCallId: string
}

const JSON_INDENT = 2

const bodyCss = css`
  max-height: 20rem;
  overflow: auto;
  background: var(--color-gray-50);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: var(--font-size-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`

const blockCss = css`
  display: grid;
  gap: 0.5rem;
  padding: 0.5rem 0;
`

const stringify = (body: unknown): string =>
  body === null || body === undefined ? "" : JSON.stringify(body, null, JSON_INDENT)

const Body: React.FC<{ title: string; body: unknown }> = ({ title, body }) => {
  const { t } = useTranslation()
  const text = stringify(body)
  return (
    <div className={blockCss}>
      <h3 className={headingCss}>{title}</h3>
      {text === "" ? (
        <p className={noteCss}>{t("credit-registration-admin-no-body-stored")}</p>
      ) : (
        <>
          <pre className={bodyCss}>{text}</pre>
          <CopyButton value={text} label={t("credit-registration-admin-copy-stored-body")} />
        </>
      )}
    </div>
  )
}

/**
 * The stored request and response of one call, with the ledger rows it carried beside them.
 *
 * The bodies were scrubbed when they were written and are shown exactly as stored; the ledger
 * reference table is where the names and student numbers behind each `requestItemId` live.
 */
const SuotarApiCallDetail: React.FC<Props> = ({ suotarApiCallId }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const detailQuery = useQuery({
    ...getSuotarApiCallOptions({ path: { suotar_api_call_id: suotarApiCallId } }),
    enabled: open,
  })

  return (
    <>
      <Button variant="tertiary" size="small" onClick={() => setOpen(true)}>
        {t("credit-registration-admin-show-stored-bodies")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="wide"
        title={t("credit-registration-admin-show-stored-bodies")}
      >
        {open && (
          <QueryResult query={detailQuery}>
            {(detail) => (
              <div className={blockCss}>
                <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
                {detail.error_message && <p>{detail.error_message}</p>}
                <Body
                  title={t("credit-registration-admin-stored-request")}
                  body={detail.request_body_sample}
                />
                <Body
                  title={t("credit-registration-admin-stored-response")}
                  body={detail.response_body_sample}
                />
                <h3 className={headingCss}>{t("credit-registration-heading-ledger-references")}</h3>
                {detail.ledger_references.length === 0 ? (
                  <p className={noteCss}>{t("credit-registration-admin-no-ledger-references")}</p>
                ) : (
                  <Table
                    caption={t("credit-registration-heading-ledger-references")}
                    rowKey={(row) => row.credit_registration_id}
                    rows={detail.ledger_references}
                    columns={[
                      {
                        header: t("credit-registration-admin-column-request-item-id"),
                        cell: (row) => (
                          <Link
                            href={creditRegistrationItemRoute(row.credit_registration_id)}
                            prefetch={false}
                          >
                            <code>{row.request_item_id}</code>
                          </Link>
                        ),
                      },
                      {
                        header: t("label-student"),
                        cell: (row) => [row.first_name, row.last_name].filter(Boolean).join(" "),
                      },
                      {
                        header: t("label-email"),
                        cell: (row) => row.email ?? RELATIVE_TIME_ABSENT_LABEL,
                      },
                      {
                        header: t("label-student-number"),
                        cell: (row) => row.student_number ?? RELATIVE_TIME_ABSENT_LABEL,
                      },
                      { header: t("label-course"), cell: (row) => row.course_name },
                      {
                        header: t("label-state"),
                        cell: (row) => <AdminStateBadge state={row.state} />,
                      },
                      {
                        header: t("label-error-code"),
                        cell: (row) =>
                          row.error_code ? (
                            <code>{row.error_code}</code>
                          ) : (
                            RELATIVE_TIME_ABSENT_LABEL
                          ),
                      },
                    ]}
                  />
                )}
                <h3 className={headingCss}>{t("credit-registration-heading-timeline")}</h3>
                {detail.events.length === 0 ? (
                  <p className={noteCss}>{t("credit-registration-admin-no-events-for-call")}</p>
                ) : (
                  <Table
                    caption={t("credit-registration-heading-timeline")}
                    rowKey={(row) => row.id}
                    rows={detail.events}
                    columns={[
                      {
                        header: t("label-time"),
                        cell: (row) => (
                          <RelativeTime at={row.created_at} absoluteTime={TIME_IN_TITLE} />
                        ),
                      },
                      {
                        header: t("label-kind"),
                        cell: (row) => eventKindLabel(t, row.kind),
                      },
                      {
                        header: t("label-state"),
                        cell: (row) =>
                          row.to_state ? (
                            <AdminStateBadge state={row.to_state} />
                          ) : (
                            RELATIVE_TIME_ABSENT_LABEL
                          ),
                      },
                      {
                        header: t("label-error-code"),
                        cell: (row) =>
                          row.error_code ? (
                            <code>{row.error_code}</code>
                          ) : (
                            RELATIVE_TIME_ABSENT_LABEL
                          ),
                      },
                      {
                        header: t("label-credit-registration-registration"),
                        cell: (row) => (
                          <Link
                            href={creditRegistrationItemRoute(row.credit_registration_id)}
                            prefetch={false}
                          >
                            {t("credit-registration-admin-open-registration")}
                          </Link>
                        ),
                      },
                    ]}
                  />
                )}
              </div>
            )}
          </QueryResult>
        )}
      </Dialog>
    </>
  )
}

export default SuotarApiCallDetail
