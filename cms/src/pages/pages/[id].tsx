import Layout from "../../components/Layout"
import dynamic from "next/dynamic"
import { useQuery } from "react-query"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../utils/dontRenderUntilQueryParametersReady"
import { useEffect } from "react"
import { useSetRecoilState } from "recoil"
import { exercisesState } from "../../state/exercises"
import { fetchPageWithId } from "../../services/backend/pages"

const EditorLoading = <div>Loading editor...</div>

const Editor = dynamic(() => import("../../components/Editor"), {
  ssr: false,
  loading: () => EditorLoading,
})

// const GutenbergEditor = dynamic(() => import('../../components/GutenbergEditor'), {
//   ssr: false,
//   loading: () => <div>Loading editor...</div>,
// })

interface PagesProps {
  query: SimplifiedUrlQuery
}

const Pages = ({ query }: PagesProps) => {
  const { id } = query
  const { isLoading, error, data } = useQuery(`page-${id}`, () => fetchPageWithId(id))
  const setExercises = useSetRecoilState(exercisesState)

  useEffect(() => {
    const exerciseArray = data?.exercises
    if (!exerciseArray) {
      return
    }
    // const obj = {}
    // exerciseArray.forEach((element) => {
    //   obj[element.id] = element
    // })
    setExercises(exerciseArray.map((ex) => ex.id))
  }, [data])

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
  }

  return (
    <Layout>
      <Editor data={data} />
      {/* <GutenbergEditor /> */}
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Pages)
