import { Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import { useState } from "react"
import { useQuery } from "react-query"

import { fetchEditProposalCount } from "../../services/backend/proposedEdits"
import EditProposalPage from "../EditProposalPage"

interface Props {
  courseId: string
  pending: boolean
  perPage: number
}

const EditProposalList: React.FC<Props> = ({ courseId, pending, perPage }) => {
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const { isLoading, error, data, refetch } = useQuery(`edit-proposal-count-${courseId}`, () => {
    return fetchEditProposalCount(courseId)
  })

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading change requests...</div>
  }
  const items = pending ? data.pending : data.handled
  if (items <= 0) {
    return <div>No change requests</div>
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
        onChange={refetch}
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

export default EditProposalList
