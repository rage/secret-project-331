import Layout from "../../components/Layout"
import ColorPalette from "../../components/page-specific/colors/ColorPalette"
import { wideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"

const Home: React.FC = () => {
  return (
    <Layout>
      <div className={wideWidthCenteredComponentStyles}>
        <ColorPalette />
      </div>
    </Layout>
  )
}

export default Home
