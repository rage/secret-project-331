"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { CourseCreditRegistration } from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { Badge, Dialog, QueryResult, Table } from "@/shared-module/components"

import { TONE } from "./constants"
import { noteCss, stackedCellCss } from "./styles"
import { linkingEmailSentence } from "./teacherCreditRegistrations"

interface Props {
  courseId: string
  open: boolean
  onClose: () => void
}

const ROWS_PER_PAGE = 25

/**
 * `pending` is the only state the endpoint can narrow to, and it also holds rows waiting on a
 * completion, so the list is filtered here. Paging is therefore this component's: paging the
 * server's unfiltered `pending` set would hand back pages with nothing on them.
 */
const PENDING_ROWS_FETCHED = 1000

// oxlint-disable-next-line i18next/no-literal-string
const PENDING = "pending" as const
// oxlint-disable-next-line i18next/no-literal-string
const NEEDS_STUDENT_NUMBER = "needs_student_number" as const

const ABSENT = "—"

const studentName = (row: CourseCreditRegistration): string =>
  [row.last_name, row.first_name].filter(Boolean).join(" ")

const UnlinkedStudentsDialog: React.FC<Props> = ({ courseId, open, onClose }) => {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const listQuery = useQuery({
    ...getCourseCreditRegistrationsOptions({
      path: { course_id: courseId },
      query: { page: 1, limit: PENDING_ROWS_FETCHED, state: PENDING },
    }),
    enabled: open,
  })

  const unlinked = useMemo(
    () =>
      (listQuery.data?.data ?? []).filter(
        (row) => row.student_facing_status === NEEDS_STUDENT_NUMBER,
      ),
    [listQuery.data],
  )
  const totalPages = Math.max(Math.ceil(unlinked.length / ROWS_PER_PAGE), 1)
  const currentPage = Math.min(page, totalPages)
  const shown = unlinked.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("label-credit-registration-unlinked-enrolled-students")}
      size="wide"
    >
      <QueryResult query={listQuery}>
        {(list) => (
          <>
            {list.total_pages > 1 && (
              <p className={noteCss}>
                {t("credit-registration-unlinked-students-capped", { max: PENDING_ROWS_FETCHED })}
              </p>
            )}
            {unlinked.length === 0 ? (
              <p className={noteCss}>{t("credit-registration-no-unlinked-students")}</p>
            ) : (
              <>
                <Table
                  caption={t("label-credit-registration-unlinked-enrolled-students")}
                  rowKey={(row) => row.id}
                  rows={shown}
                  columns={[
                    {
                      header: t("label-student"),
                      cell: (row) => (
                        <span className={stackedCellCss}>
                          <span>{studentName(row) || ABSENT}</span>
                          <span className={noteCss}>{row.email}</span>
                        </span>
                      ),
                    },
                    {
                      header: t("label-student-number"),
                      cell: (row) =>
                        row.student_number ? (
                          <Badge tone={TONE.NEUTRAL}>{row.student_number}</Badge>
                        ) : (
                          ABSENT
                        ),
                    },
                    {
                      header: t("label-credit-registration-linking-email"),
                      cell: (row) =>
                        row.linking_email
                          ? linkingEmailSentence(
                              t,
                              row.linking_email.email_send_status,
                              row.linking_email.sent_at,
                              row.linking_email.emailed_to_masked,
                              i18n.language,
                            )
                          : ABSENT,
                    },
                  ]}
                />
                <Pagination
                  totalPages={totalPages}
                  paginationInfo={{
                    page: currentPage,
                    setPage,
                    limit: ROWS_PER_PAGE,
                    setLimit: () => undefined,
                  }}
                  disableItemsPerPage
                />
              </>
            )}
          </>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default UnlinkedStudentsDialog
