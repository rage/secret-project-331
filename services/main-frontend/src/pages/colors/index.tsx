import Layout from "../../components/Layout"
import ColorPalette from "../../components/page-specific/colors/ColorPalette"

const Home: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <Layout>
      <div>
        <ColorPalette />
      </div>
    </Layout>
  )
}

export default Home
