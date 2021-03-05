import Head from 'next/head'
import dynamic from 'next/dynamic'
import { ComponentType } from 'react';

const Editor:ComponentType = dynamic(() => import("../components/Editor"),
  {ssr: false}
)


const Home = () => {
  return (
    <>
      <div>Hello world</div>
      <Editor />
    </>
    )
}
export default Home
