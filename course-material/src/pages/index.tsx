import { useQuery } from "react-query"
import styled from "@emotion/styled"
import { fetchOrganizations } from "../services/backend"
import basePath from "../utils/base-path"
import Link from "next/link"

const Title = styled.h1`
  font-size: 24px;
`

const Home: React.FC = () => {
  const { isLoading, error, data } = useQuery(`organizations`, () => fetchOrganizations())

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  return (
    <>
      <Title>Organizations</Title>

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
    </>
  )
}

export default Home
