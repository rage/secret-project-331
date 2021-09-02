import Layout from "../../components/Layout"
import OrganizationsList from "../../components/lists/OrganizationsList"
import basePath from "../../shared-module/utils/base-path"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Home: React.FC = () => {
  return (
    <Layout>
      <OrganizationsList />
    </Layout>
  )
}

export default withErrorBoundary(Home)
