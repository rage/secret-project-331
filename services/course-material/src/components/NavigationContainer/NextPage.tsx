import { Button } from "@material-ui/core"
import Link from "next/link"
import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"
import { getNextPageRoutingData } from "../../services/backend"
import GenericLoading from "../GenericLoading"

export interface NextPageProps {
  chapterId: string | null
  currentPageId: string
}

const NextPage: React.FC<NextPageProps> = ({ chapterId, currentPageId }) => {
  const { isLoading, error, data } = useQuery(`pages-${currentPageId}-next-page`, () =>
    getNextPageRoutingData(currentPageId),
  )
  const router = useRouter()

  const courseSlug = router.query.courseSlug

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || data === undefined) {
    return <GenericLoading />
  }

  return (
    <div>
      {data != null ? (
        <>
          {chapterId !== data.chapter_id ? (
            <p>Go to the next chapter</p>
          ) : (
            <p>Go to the next page</p>
          )}
          <Link href={"/" + courseSlug + data.url_path}>
            <Button>{data.title}</Button>
          </Link>
        </>
      ) : (
        <p>This is the last page</p>
      )}
    </div>
  )
}

export default NextPage
