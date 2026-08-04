"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CreditRegistrationState } from "@/generated/api/types.generated"
import { Badge, Button, Dialog, QueryResult } from "@/shared-module/components"

import { linkingEmailSentence } from "./teacherCreditRegistrations"

interface Props {
  courseId: string
  /** The one state the list is about, so the copy and the filter cannot drift. */
  state: CreditRegistrationState
  title: string
  open: boolean
  onClose: () => void
}

const PAGE_SIZE = 50

const listCss = css`
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
`

const rowCss = css`
  display: grid;
  gap: 0.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-clear-300);
`

const identityCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
`

const secondaryCss = css`
  color: var(--color-gray-600);
  font-size: 0.875rem;
`

const pagerCss = css`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1rem;
`

// oxlint-disable-next-line i18next/no-literal-string
const NUMBER_TONE = "neutral" as const

/** The students of one course sitting in one registration state, with what we can say about them. */
const BlockedStudentsDialog: React.FC<Props> = ({ courseId, state, title, open, onClose }) => {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const listQuery = useQuery({
    ...getCourseCreditRegistrationsOptions({
      path: { course_id: courseId },
      query: { page, limit: PAGE_SIZE, state },
    }),
    enabled: open,
  })

  return (
    <Dialog open={open} onClose={onClose} title={title} size="wide">
      <QueryResult query={listQuery}>
        {(list) => (
          <>
            <ul className={listCss}>
              {list.data.map((row) => (
                <li className={rowCss} key={row.id}>
                  <div className={identityCss}>
                    <span>
                      {row.last_name} {row.first_name}
                    </span>
                    <span className={secondaryCss}>{row.email}</span>
                    {row.student_number && <Badge tone={NUMBER_TONE}>{row.student_number}</Badge>}
                  </div>
                  {row.linking_email && (
                    <div className={secondaryCss}>
                      {linkingEmailSentence(
                        t,
                        row.linking_email.email_send_status,
                        row.linking_email.sent_at,
                        row.linking_email.emailed_to_masked,
                        i18n.language,
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className={pagerCss}>
              <Button
                variant="secondary"
                size="small"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                {t("button-text-previous-page")}
              </Button>
              <span className={secondaryCss}>
                {t("page-of-total-pages", { page, pages: Math.max(list.total_pages, 1) })}
              </span>
              <Button
                variant="secondary"
                size="small"
                disabled={page >= list.total_pages}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("button-text-next-page")}
              </Button>
            </div>
          </>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default BlockedStudentsDialog
