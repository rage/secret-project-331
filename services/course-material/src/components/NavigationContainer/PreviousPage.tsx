import { Button } from "@material-ui/core"
import Link from "next/link"
import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"
import { getPreviousPageRoutingData } from "../../services/backend"
import GenericLoading from "../GenericLoading"

const PreviousPage: React.FC<{ currentPageId: string }> = ({ currentPageId }) => {
  const { isLoading, error, data } = useQuery(`pages-${currentPageId}-previous-page`, () =>
    getPreviousPageRoutingData(currentPageId),
  )
  const router = useRouter()

  const courseSlug = router.query.courseSlug

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <div>
      {data.url_path ? (
        <>
          <p>Go to the previous page</p>
          <Link href={"/" + courseSlug + data.url_path}>
            <Button>{data.title}</Button>
          </Link>
        </>
      ) : (
        <p>this is the first page</p>
      )}
    </div>
  )
}

export default PreviousPage
