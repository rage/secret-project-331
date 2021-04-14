import dynamic from "next/dynamic"
import Layout from "../components/Layout"

const LoadingEditor = () => <div>Loading editor...</div>

const Editor = dynamic(() => import("../components/Editor"), {
  ssr: false,
  loading: LoadingEditor,
})

const playground = {
  id: "playground",
  content: [],
  url_path: "/playground",
  title: "Playground",
  exercises: [],
  created_at: Date.now().toString(),
  updated_at: Date.now().toString(),
  course_id: "playground",
  deleted: false,
}

const Home: React.FC = () => {
  return (
    <Layout>
      <h2>This is the playground</h2>
      <Editor data={playground} />
    </Layout>
  )
}
export default Home
