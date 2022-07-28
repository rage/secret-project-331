import { Pagination } from "@mui/material"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { fetchFeedbackCount } from "../../../../../../services/backend/feedback"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

import FeedbackPage from "./FeedbackPage"

interface Props {
  courseId: string
  read: boolean
  perPage: number
}

const FeedbackList: React.FC<React.PropsWithChildren<Props>> = ({ courseId, read, perPage }) => {
  const { t } = useTranslation()
  const router = useRouter()

  let initialPage: number
  if (typeof router.query.page === "string") {
    initialPage = parseInt(router.query.page)
  } else {
    initialPage = 1
  }
  const [page, setPage] = useState(initialPage)

  const getFeedbackCount = useQuery([`feedback-count-${courseId}`], () =>
    fetchFeedbackCount(courseId),
  )

  if (getFeedbackCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getFeedbackCount.error} />
  }

  if (getFeedbackCount.isLoading) {
    return <Spinner variant={"medium"} />
  }

  const items = read ? getFeedbackCount.data.read : getFeedbackCount.data.unread
  if (items <= 0) {
    return <div>{t("no-feedback")}</div>
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
        onChange={getFeedbackCount.refetch}
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
