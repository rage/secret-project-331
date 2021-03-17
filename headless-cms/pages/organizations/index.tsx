import { fetchOrganizations } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import { useQuery } from 'react-query'

const Home = () => {
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
      {data.map((org) => (
        <div key={org.id}>
          <div>Name: {org.name}</div>
          <div>Id: {org.id}</div>
        </div>
      ))}
    </Layout>
  )
}
export default Home
