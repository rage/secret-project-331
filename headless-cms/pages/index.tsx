import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ComponentType } from 'react'
import Layout from '../components/Layout'

const Editor: ComponentType = dynamic(() => import('../components/Editor'), { ssr: false })

const Home = () => {
  return (
    <Layout>
      <Editor />
    </Layout>
  )
}
export default Home
