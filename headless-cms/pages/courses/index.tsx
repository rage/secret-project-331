import React, { useEffect, useState } from 'react'
import { fetchCourses } from '../../utils/fetchData'
import Layout from '../../components/Layout'
import Link from 'next/link'
import { useQuery } from 'react-query'

const Home = () => {
  const { isLoading, error, data } = useQuery(`courses`, () => fetchCourses())

  if (error) {
    return <div>Error loading organizations.</div>
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      {data.map((c) => (
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
