import Layout from "../../components/Layout"
import OrganizationsList from "../../components/lists/OrganizationsList"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"

const Home: React.FC = () => {
  return (
    <Layout>
      <OrganizationsList />
    </Layout>
  )
}

export default withErrorBoundary(Home)
