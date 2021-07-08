import Layout from "../../components/Layout"
import { useQuery } from "react-query"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../utils/dontRenderUntilQueryParametersReady"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { Page, PageUpdate } from "../../services/services.types"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import dynamic from "next/dynamic"
import CourseContext from "../../contexts/CourseContext"

interface PagesProps {
  query: SimplifiedUrlQuery
}

const EditorLoading = <div>Loading editor...</div>

const PageEditor = dynamic(() => import("../../components/editors/PageEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const Pages = ({ query }: PagesProps) => {
  const { id } = query
  const { isLoading, error, data, refetch } = useQuery(`page-${id}`, () => fetchPageWithId(id))

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

  const handleSave = async (page: PageUpdate): Promise<Page> => {
    const res = await updateExistingPage({
      page_id: id,
      ...page,
    })
    console.log(res)
    await refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseInstanceId: data.course_id }}>
      <Layout>
        <PageEditor data={data} handleSave={handleSave} />
      </Layout>
    </CourseContext.Provider>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(Pages))
