import dynamic from 'next/dynamic'
import { ComponentType } from 'react'
import Layout from '../components/Layout'

const Editor: ComponentType = dynamic(() => import('../components/Editor'), { ssr: false })

const Home = () => {
  return (
    <Layout>
      <h2>This is the playground</h2>
      <Editor />
    </Layout>
  )
}
export default Home
