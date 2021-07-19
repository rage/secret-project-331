import dynamic from "next/dynamic"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { Page, PageUpdate } from "../../shared-module/bindings"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../utils/dontRenderUntilQueryParametersReady"

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
    const res = await updateExistingPage(id, page)
    console.log(res)
    await refetch()
    return res
  }

  return (
    <Layout>
      <PageEditor data={data} handleSave={handleSave} />
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
