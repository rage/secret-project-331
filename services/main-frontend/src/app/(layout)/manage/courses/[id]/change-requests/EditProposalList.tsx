"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import { getEditProposalCountOptions } from "@/generated/api/@tanstack/react-query.generated"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { Pagination, QueryResult } from "@/shared-module/components"

import EditProposalPage from "./EditProposalPage"

interface Props {
  courseId: string
  pending: boolean
  perPage: number
}

const EditProposalList: React.FC<React.PropsWithChildren<Props>> = ({
  courseId,
  pending,
  perPage,
}) => {
  const { t } = useTranslation()
  const paginationInfo = usePaginationInfo()

  const getEditProposalCount = useQuery({
    ...getEditProposalCountOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  return (
    <QueryResult query={getEditProposalCount}>
      {(data) => {
        const items = pending ? data.pending : data.handled
        if (items <= 0) {
          return <div>{t("no-change-requests")}</div>
        }

        const pageCount = Math.ceil(items / perPage)

        return (
          <div>
            <EditProposalPage
              courseId={courseId}
              page={paginationInfo.page}
              pending={pending}
              limit={perPage}
              onChange={getEditProposalCount.refetch}
            />
            <Pagination
              totalPages={pageCount}
              page={paginationInfo.page}
              onPageChange={paginationInfo.setPage}
              itemsPerPage={paginationInfo.limit}
              onItemsPerPageChange={paginationInfo.setLimit}
            />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default EditProposalList
