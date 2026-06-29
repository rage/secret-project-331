"use client"

import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import EditProposalPage from "./EditProposalPage"

import { getEditProposalCountOptions } from "@/generated/api/@tanstack/react-query.generated"
import Pagination from "@/shared-module/common/components/Pagination"
import usePaginationInfo from "@/shared-module/common/hooks/usePaginationInfo"
import { QueryResult } from "@/shared-module/components"

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
            <Pagination totalPages={pageCount} paginationInfo={paginationInfo} />
          </div>
        )
      }}
    </QueryResult>
  )
}

export default EditProposalList
