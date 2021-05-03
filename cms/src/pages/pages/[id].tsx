import Layout from "../../components/Layout"
import { useQuery } from "react-query"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../utils/dontRenderUntilQueryParametersReady"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { Page, PageUpdate } from "../../services/services.types"
import PageEditor from "../../components/PageEditor"

interface PagesProps {
  query: SimplifiedUrlQuery
}

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

  const handleSave = (page: PageUpdate): void => {
    updateExistingPage({
      page_id: id,
      ...page,
    }).then((res: Page) => {
      console.log(res)
      refetch()
    })
  }

  return (
    <Layout>
      <PageEditor data={data} handleSave={handleSave} />
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Pages)
