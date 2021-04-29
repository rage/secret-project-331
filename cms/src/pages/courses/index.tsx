import React from "react"
import Layout from "../../components/Layout"
import Link from "next/link"
import { useQuery } from "react-query"
import { fetchCourses } from "../../services/backend/courses"

const Home: React.FC = () => {
  const { isLoading, error, data } = useQuery(`courses`, () => fetchCourses(), {
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
      {data.map((c) => (
        <div key={c.id}>
          <div>Name: {c.name}</div>
          <div>Id: {c.id}</div>
          <Link
            href={{ pathname: "/courses/[id]/overview", query: { data: JSON.stringify(c.name) } }}
            as={`/courses/${c.id}/overview`}
          >
            Course overview
          </Link>
        </div>
      ))}
    </Layout>
  )
}
export default Home
