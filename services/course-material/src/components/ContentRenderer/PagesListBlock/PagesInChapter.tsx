import Link from "next/link"
import { useRouter } from "next/router"
import React from "react"
import { useQuery } from "react-query"

import { fetchChaptersPagesExcludeFrontpage } from "../../../services/backend"
import GenericLoading from "../../GenericLoading"

const PagesInChapter: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const courseSlug = useRouter().query.courseSlug
  const { isLoading, error, data } = useQuery(
    `chapter-${chapterId}-pages-excluding-frontpage`,
    () => fetchChaptersPagesExcludeFrontpage(chapterId),
  )
  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <>
      {data.length > 0 && (
        <>
          <h3>Pages in this chapter</h3>
          <ol>
            {data.map((page) => (
              <li key={page.id} id={page.id}>
                <Link href={"/" + courseSlug + page.url_path}>{page.title}</Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  )
}
export default PagesInChapter
