import { fetchPageWithId } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import dynamic from 'next/dynamic'
import { useQuery } from 'react-query'
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from '../../utils/dontRenderUntilQueryParametersReady'

const Editor = dynamic(() => import('../../components/Editor'), {
  ssr: false,
  loading: () => <div>Loading editor...</div>,
})

interface PagesProps {
  query: SimplifiedUrlQuery
}

const Pages = ({ query }: PagesProps) => {
  const { id } = query
  const { isLoading, error, data } = useQuery(`page-${id}`, () => fetchPageWithId(id))

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
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(Pages)
