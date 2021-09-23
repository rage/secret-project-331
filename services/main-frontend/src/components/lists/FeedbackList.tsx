import { Pagination } from "@material-ui/core"
import { useRouter } from "next/router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchFeedbackCount } from "../../services/backend/feedback"
import FeedbackPage from "../FeedbackPage"

interface Props {
  courseId: string
  read: boolean
  perPage: number
}

const FeedbackList: React.FC<Props> = ({ courseId, read, perPage }) => {
  const { t } = useTranslation()
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
        <h1>{t("error-title")}</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
  }
  const pageCount = Math.floor((read ? data.read : data.unread) / perPage)
  if (pageCount < 1) {
    return <div>{t("no-feedback")}</div>
  }
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
