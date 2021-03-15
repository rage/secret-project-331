import React, { useEffect, useState } from 'react'
import { fetchCourses, fetchCoursePages } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import Link from 'next/link'

const Home = () => {
  const [courses, setCourses] = useState([])
  useEffect(() => {
    fetchCourses()
      .then((result) => setCourses(result))
      .catch()
  }, [])

  return (
    <Layout>
      {courses.map((c) => (
        <div style={{ border: '1px dashed black', padding: '1rem' }} key={c.id}>
          <div>Name: {c.name}</div>
          <div>Id: {c.id}</div>
          <Link href="/courses/[id]/pages" as={`/courses/${c.id}/pages`}>
            Course pages
          </Link>
        </div>
      ))}
    </Layout>
  )
}
export default Home
