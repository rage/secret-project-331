import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import { getNextPageRoutingData } from "../../../services/backend"
import NextSectionLink from "../../../shared-module/components/NextSectionLink"
import GenericLoading from "../../GenericLoading"

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
            <NextSectionLink
              title="Impressive! you’ve reach the end of this chapter."
              subTitle="Proceed to the next chapter"
              nextTitle={data.title}
              url={"/courses/" + courseSlug + data.url_path}
            />
          ) : (
            <NextSectionLink
              title="Impressive! you’ve reach the end of this topic."
              subTitle="Proceed to the next topic"
              nextTitle={data.title}
              url={"/courses/" + courseSlug + data.url_path}
            />
          )}
        </>
      ) : (
        <NextSectionLink
          title="You've reached the end of the course material"
          subTitle="Go to the main page to see if new chapters will open."
          nextTitle={"Back to main page"}
          url={"/courses/" + courseSlug}
        />
      )}
    </div>
  )
}

export default NextPage
