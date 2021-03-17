import React, { useEffect, useState } from 'react'

import { useRouter } from 'next/router'
import Layout from '../../../components/Layout'
import { fetchCoursePages } from '../../../utils/fetchData'
import Link from 'next/link'
import useQueryParameter from '../../../hooks/useQueryParameter'
import { useQuery } from 'react-query'

export default function CoursePages() {
  const id = useQueryParameter('id')
  const { isLoading, error, data } = useQuery(`course-pages-${id}`, () => fetchCoursePages(id))

  if (error) {
    return <div>Error loading organizations.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  return (
    <Layout>
      <div>Course pages for {id}</div>
      <ul>
        {data?.map((page) => (
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
