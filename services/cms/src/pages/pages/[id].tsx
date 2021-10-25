import dynamic from "next/dynamic"
import { useReducer } from "react"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import CourseContext from "../../contexts/CourseContext"
import PageContext, {
  defaultPageContext,
  PageDispatch,
  pageStateDispatch,
} from "../../contexts/PageContext"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { Page, PageUpdate } from "../../shared-module/bindings"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { denormalizeDocument, normalizeDocument } from "../../utils/documentSchemaProcessor"

interface PagesProps {
  query: SimplifiedUrlQuery<"id">
}

const EditorLoading = <div>Loading editor...</div>

const PageEditor = dynamic(() => import("../../components/editors/PageEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const Pages = ({ query }: PagesProps) => {
  const [pageContext, pageContextDispatch] = useReducer(pageStateDispatch, defaultPageContext)
  const { id } = query
  const { isLoading, error, data, refetch } = useQuery(`page-${id}`, async () => {
    const data = await fetchPageWithId(id)
    const page: Page = { ...data.page, content: denormalizeDocument(data) }
    return page
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
    return <div>Loading page...</div>
  }

  const handleSave = async (page: PageUpdate): Promise<Page> => {
    const res = await updateExistingPage(
      id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeDocument(id, page.content as any, page.title, page.url_path, page.chapter_id),
    )
    console.log(res)
    await refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseId: data.course_id }}>
      <PageDispatch.Provider value={pageContextDispatch}>
        <PageContext.Provider value={pageContext}>
          <Layout frontPageUrl={`/manage/courses/${data.course_id}/pages`}>
            <PageEditor data={data} handleSave={handleSave} />
          </Layout>
        </PageContext.Provider>
      </PageDispatch.Provider>
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
