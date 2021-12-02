import { Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchEditProposalCount } from "../../../../../../services/backend/proposedEdits"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

import EditProposalPage from "./EditProposalPage"

interface Props {
  courseId: string
  pending: boolean
  perPage: number
}

const EditProposalList: React.FC<Props> = ({ courseId, pending, perPage }) => {
  const { t } = useTranslation()
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const getEditProposalCount = useQuery(`edit-proposal-count-${courseId}`, () => {
    return fetchEditProposalCount(courseId)
  })

  if (getEditProposalCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getEditProposalCount.error} />
  }

  if (getEditProposalCount.isLoading) {
    return <Spinner variant="medium" />
  }

  if (getEditProposalCount.isSuccess) {
    const items = pending ? getEditProposalCount.data.pending : getEditProposalCount.data.handled
    if (items <= 0) {
      return <div>{t("no-change-requests")}</div>
    }

    const pageCount = Math.ceil(items / perPage)
    if (page > pageCount) {
      setPage(pageCount)
    }

    return (
      <div>
        <EditProposalPage
          courseId={courseId}
          page={page}
          pending={pending}
          limit={perPage}
          onChange={getEditProposalCount.refetch}
        />
        <Pagination
          count={pageCount}
          page={page}
          onChange={(_, val) => {
            router.replace({ query: { ...router.query, page: val } }, undefined, { shallow: true })
            setPage(val)
          }}
        />
      </div>
    )
  }
  return (
    <ErrorBanner
      variant={"readOnly"}
      error={t("error-unknown-in-component", { component: "EditProposalList" })}
    />
  )
}

export default EditProposalList
