import dynamic from 'next/dynamic'
import { ComponentType } from 'react'
import { fetchOrganizations } from '../utils/fetchData'

const Editor: ComponentType = dynamic(() => import('../components/Editor'), { ssr: false })

const Home = () => {
  return (
    <>
      <div>Hello world</div>
      <Editor />
      <button onClick={fetchOrganizations}>Fetch org</button>
    </>
  )
}
export default Home
