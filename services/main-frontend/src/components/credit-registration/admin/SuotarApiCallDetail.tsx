"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import AbsentValue from "@/components/credit-registration/AbsentValue"
import { getSuotarApiCallOptions } from "@/generated/api/@tanstack/react-query.generated"
import { formatUserName } from "@/hooks/useUserDetails"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { isRecord } from "@/shared-module/common/utils/objects"
import {
  creditRegistrationItemRoute,
  creditRegistrationSuotarApiCallRoute,
} from "@/shared-module/common/utils/routes"
import { Button, Dialog, Link, QueryResult, Table } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, DENSITY_COMPACT } from "../constants"
import {
  emptyStateCss,
  codeValueCss,
  noteCss,
  sectionCss,
  stackedCellCss,
  subheadingCss,
  subsectionCss,
} from "../styles"
import AdminStateLabel from "./AdminStateLabel"
import ErrorCodeCell from "./ErrorCodeCell"
import PayloadBlock from "./PayloadBlock"

interface Props {
  suotarApiCallId: string
}

const exchangeCss = css`
  display: grid;
  gap: var(--space-4);

  ${respondToOrLarger.lg} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`

const Body: React.FC<{ title: string; body: unknown }> = ({ title, body }) => (
  <div className={subsectionCss}>
    <h3 className={subheadingCss}>{title}</h3>
    <PayloadBlock body={body} />
  </div>
)

const REQUEST = "request"
const RESPONSE = "response"

const exchangePart = (exchange: unknown, part: typeof REQUEST | typeof RESPONSE): unknown =>
  isRecord(exchange) ? exchange[part] : undefined

/**
 * One registration's own part of a call: the request item we sent and the response item we got,
 * or a note that none was kept. The rest of the batch belongs to other students, so it is behind
 * a link to the whole call.
 */
export const RegistrationCallItem: React.FC<Props & { exchange: unknown }> = ({
  suotarApiCallId,
  exchange,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div className={sectionCss}>
      <p className={noteCss}>{t("credit-registration-admin-item-scrubbing-note")}</p>
      {exchange === null || exchange === undefined ? (
        <p className={emptyStateCss}>{t("credit-registration-admin-no-registration-item")}</p>
      ) : (
        <div className={exchangeCss}>
          <Body
            title={t("credit-registration-admin-request-item")}
            body={exchangePart(exchange, REQUEST)}
          />
          <Body
            title={t("credit-registration-admin-response-item")}
            body={exchangePart(exchange, RESPONSE)}
          />
        </div>
      )}
      <Link href={creditRegistrationSuotarApiCallRoute(suotarApiCallId)} prefetch={false}>
        {t("credit-registration-admin-show-whole-call")}
      </Link>
    </div>
  )
}

/**
 * The stored request and response of one call, with the ledger rows it carried beside them.
 *
 * Fetches when it is rendered, so a table hands it to an expanded row rather than to every row.
 * The bodies were scrubbed when they were written and are shown exactly as stored; the ledger
 * reference table is where the names and student numbers behind each `requestItemId` live.
 */
export const SuotarApiCallBodies: React.FC<Props> = ({ suotarApiCallId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const detailQuery = useQuery(
    getSuotarApiCallOptions({ path: { suotar_api_call_id: suotarApiCallId } }),
  )

  return (
    <QueryResult query={detailQuery}>
      {(detail) => (
        <div className={sectionCss}>
          <p className={noteCss}>{t("credit-registration-admin-scrubbing-note")}</p>
          {detail.error_message && (
            <p>
              <strong>{t("credit-registration-admin-call-error-message")}:</strong>{" "}
              {detail.error_message}
            </p>
          )}
          <Body
            title={t("credit-registration-admin-stored-request")}
            body={detail.request_body_sample}
          />
          <Body
            title={t("credit-registration-admin-stored-response")}
            body={detail.response_body_sample}
          />
          <div className={subsectionCss}>
            <h3 className={subheadingCss}>{t("credit-registration-heading-ledger-references")}</h3>
            {detail.ledger_references.length === 0 ? (
              <p className={emptyStateCss}>{t("credit-registration-admin-no-ledger-references")}</p>
            ) : (
              <Table
                caption={t("credit-registration-heading-ledger-references")}
                density={DENSITY_COMPACT}
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
                        <code className={codeValueCss}>
                          {row.request_item_id ?? <AbsentValue />}
                        </code>
                      </Link>
                    ),
                  },
                  {
                    header: t("label-student"),
                    cell: (row) => formatUserName(row),
                  },
                  {
                    header: t("label-email"),
                    cell: (row) => row.email ?? <AbsentValue />,
                  },
                  {
                    header: t("label-student-number"),
                    cell: (row) => (
                      <span className={codeValueCss}>{row.student_number ?? <AbsentValue />}</span>
                    ),
                  },
                  { header: t("label-course"), cell: (row) => row.course_name },
                  {
                    header: t("credit-registration-admin-column-effect-of-call"),
                    cell: (row) => {
                      const effects = detail.events.filter(
                        (event) => event.credit_registration_id === row.credit_registration_id,
                      )
                      if (effects.length === 0) {
                        return t("credit-registration-admin-no-change")
                      }
                      return (
                        <div className={stackedCellCss}>
                          {effects.map((event) => (
                            <div key={event.id}>
                              {event.to_state ? <AdminStateLabel state={event.to_state} /> : null}
                              {event.error_code ? (
                                <ErrorCodeCell errorCode={event.error_code} />
                              ) : null}
                              {event.message ? <div>{event.message}</div> : null}
                            </div>
                          ))}
                        </div>
                      )
                    },
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </QueryResult>
  )
}

/** The same bodies behind a button, for a table whose rows cannot expand. */
const SuotarApiCallDetail: React.FC<Props> = ({ suotarApiCallId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Short in the cell, long to a screen reader: this button repeats 50 times down a table. */}
      <Button
        variant="tertiary"
        size="small"
        aria-label={t("credit-registration-admin-show-stored-bodies")}
        onClick={() => setOpen(true)}
      >
        {t("credit-registration-admin-payloads")}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="wide"
        title={t("credit-registration-admin-show-stored-bodies")}
      >
        {open && <SuotarApiCallBodies suotarApiCallId={suotarApiCallId} />}
      </Dialog>
    </>
  )
}

export default SuotarApiCallDetail
