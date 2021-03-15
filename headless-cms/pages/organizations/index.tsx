import { useEffect, useState } from 'react'
import { fetchOrganizations } from '../../utils/fetchData'
import Layout from '../../components/Layout'

const Home = () => {
  const [organizations, setOrganizations] = useState([])
  useEffect(() => {
    fetchOrganizations()
      .then((result) => setOrganizations(result))
      .catch()
  }, [])

  return (
    <Layout>
      {organizations.map((org) => (
        <div key={org.id}>
          <div>Name: {org.name}</div>
          <div>Id: {org.id}</div>
        </div>
      ))}
    </Layout>
  )
}
export default Home
