import { ComponentType, useEffect, useState } from 'react'
import { fetchPageWithId } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import('../../components/Editor'), { ssr: false })

const Pages = () => {
  const router = useRouter()
  const {
    query: { id },
  } = router
  const [page, setPage] = useState([])

  useEffect(() => {
    fetchPageWithId(id as string)
      .then((result) => setPage(result))
      .catch()
  }, [router])

  return (
    <Layout>
      <Editor props={page} />
    </Layout>
  )
}
export default Pages
