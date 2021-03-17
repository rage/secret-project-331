import { fetchPageWithId } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import dynamic from 'next/dynamic'
import useQueryParameter from '../../hooks/useQueryParameter'
import { useQuery } from 'react-query'

const Editor = dynamic(() => import('../../components/Editor'), { ssr: false })

const Pages = () => {
  const id = useQueryParameter('id')
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
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <Editor content={data.content} />
    </Layout>
  )
}
export default Pages
