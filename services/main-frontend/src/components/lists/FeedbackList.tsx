import { Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import { useState } from "react"
import { useQuery } from "react-query"

import { fetchFeedbackCount } from "../../services/backend/feedback"
import FeedbackPage from "../FeedbackPage"

interface Props {
  courseId: string
  read: boolean
  perPage: number
}

const FeedbackList: React.FC<Props> = ({ courseId, read, perPage }) => {
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const { isLoading, error, data, refetch } = useQuery(`feedback-count-${courseId}`, () => {
    return fetchFeedbackCount(courseId)
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
    return <div>Loading feedback...</div>
  }
  const items = read ? data.read : data.unread
  if (items <= 0) {
    return <div>No feedback</div>
  }
  const pageCount = Math.ceil(items / perPage)
  if (page > pageCount) {
    setPage(pageCount)
  }

  return (
    <div>
      <FeedbackPage
        courseId={courseId}
        page={page}
        read={read}
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

export default FeedbackList
