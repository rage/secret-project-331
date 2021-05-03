import Layout from "../../components/Layout"
import { useQuery } from "react-query"
import Link from "next/link"
import basePath from "../../utils/base-path"
import { fetchOrganizations } from "../../services/backend/organizations"
import DebugModal from "../../components/DebugModal"
import { css } from "@emotion/css"

const Home: React.FC = () => {
  const { isLoading, error, data } = useQuery(`organizations`, () => fetchOrganizations(), {
    cacheTime: 60000,
  })

  if (error) {
    return <div>Error loading organizations.</div>
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <h1>Organizations</h1>
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        {data.map((organization) => (
          <div key={organization.id}>
            <Link
              href={{
                pathname: `${basePath()}/organizations/[id]`,
                query: { id: organization.id },
              }}
            >
              <a>{organization.name}</a>
            </Link>
          </div>
        ))}
      </div>
      <DebugModal data={data} />
    </Layout>
  )
}
export default Home
