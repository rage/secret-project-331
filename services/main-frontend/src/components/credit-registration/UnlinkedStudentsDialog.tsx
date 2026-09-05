"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { getCourseCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseCreditRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import { Dialog, QueryResult, Table } from "@/shared-module/components"

import { ABSENT, DENSITY_COMPACT } from "./constants"
import { noteCss, proseCss, stackedCellCss } from "./styles"
import { linkingEmailSentence } from "./teacherCreditRegistrations"

interface Props {
  courseId: string
  open: boolean
  onClose: () => void
}

const ROWS_PER_PAGE = 25

const NEEDS_STUDENT_NUMBER: StudentFacingCreditRegistrationStatus[] = ["needs_student_number"]

const studentName = (row: CourseCreditRegistration): string =>
  [row.last_name, row.first_name].filter(Boolean).join(" ")

/**
 * Who has not confirmed a student number yet, and what has been sent to them about it.
 *
 * The whole course, never one instance: the count the caller shows beside its trigger is
 * course-wide, and a narrower list under it would read as a contradiction.
 */
const UnlinkedStudentsDialog: React.FC<Props> = ({ courseId, open, onClose }) => {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const listQuery = useQuery({
    ...getCourseCreditRegistrationsOptions({
      path: { course_id: courseId },
      query: { page, limit: ROWS_PER_PAGE, status: NEEDS_STUDENT_NUMBER },
    }),
    enabled: open,
  })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("label-credit-registration-unlinked-enrolled-students")}
    >
      <p className={proseCss}>{t("credit-registration-unlinked-students-what-happens-next")}</p>
      <QueryResult query={listQuery} treatEmptyAsData>
        {(list) => (
          <>
            <Table
              caption={t("label-credit-registration-unlinked-enrolled-students")}
              density={DENSITY_COMPACT}
              rowKey={(row) => row.id}
              rows={list.data}
              emptyState={t("credit-registration-no-unlinked-students")}
              columns={[
                {
                  header: t("label-student"),
                  grow: true,
                  cell: (row) => (
                    <span className={stackedCellCss}>
                      <span>{studentName(row) || ABSENT}</span>
                      <span className={noteCss}>{row.email}</span>
                    </span>
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
            {list.total_pages > 1 && (
              <Pagination
                totalPages={list.total_pages}
                paginationInfo={{
                  page,
                  setPage,
                  limit: ROWS_PER_PAGE,
                  setLimit: () => undefined,
                }}
                disableItemsPerPage
              />
            )}
          </>
        )}
      </QueryResult>
    </Dialog>
  )
}

export default UnlinkedStudentsDialog
