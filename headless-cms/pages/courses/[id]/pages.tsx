import React, { useEffect, useState } from 'react'

import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { fetchCoursePages } from '../../../utils/fetchData'
import Link from 'next/link'

export default function CoursePages() {
  const router = useRouter()
  const {
    query: { id },
  } = router

  const [coursePages, setCoursePages] = useState([])
  useEffect(() => {
    fetchCoursePages(id as string)
      .then((result) => setCoursePages(result))
      .catch()
  }, [router])

  return (
    <Layout>
      <div>Course pages for {id}</div>
      <ul>
        {coursePages?.map((page) => (
          <li>
            <Link href="/pages/[id]" as={`/pages/${page.id}`}>
              {page.url_path}
            </Link>
          </li>
        ))}
      </ul>
    </Layout>
  )
}
