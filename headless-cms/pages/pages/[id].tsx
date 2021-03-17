import { fetchPageWithId } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import dynamic from 'next/dynamic'
import { PageData } from '../../utils/types'
import usePromise from 'react-use-promise'
import useQueryParameter from '../../hooks/useQueryParameter'

const Editor = dynamic(() => import('../../components/Editor'), { ssr: false })

const Pages = () => {
  const id = useQueryParameter('id')
  const [page, error, state] = usePromise<PageData>(fetchPageWithId(id), [id])

  if (!page) {
    return <div>Loading...</div>
  }

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  return (
    <Layout>
      <Editor content={page.content} />
    </Layout>
  )
}
export default Pages
