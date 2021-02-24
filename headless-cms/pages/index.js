import Head from 'next/head'
import dynamic from 'next/dynamic'

const Editor = dynamic(() => import("../components/Editor"),
  {ssr: false}
)


const Home = () => {
  return <>
    <div>Hello world!</div>
    <Editor />
    </>
}
export default Home
