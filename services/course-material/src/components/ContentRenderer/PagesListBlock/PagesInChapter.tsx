import React from "react"
import { useQuery } from "react-query"
import { fetchChaptersPagesWithExercises } from "../../../services/backend"
import GenericLoading from "../../GenericLoading"

const PagesInChapter: React.FC<{ chapterId: string }> = ({ chapterId }) => {
  const { isLoading, error, data } = useQuery(`chapter-${chapterId}-pages`, () =>
    fetchChaptersPagesWithExercises(chapterId),
  )
  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <>
      <h3>Pages in this chapter</h3>
      <ol>
        {data.map((page) => (
          <li key={page.id} id={page.id}>
            {page.title}
          </li>
        ))}
      </ol>
    </>
  )
}
export default PagesInChapter
