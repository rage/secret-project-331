import React from 'react'

import Layout from '../../../components/Layout'
import { fetchCoursePages } from '../../../services/fetchData'
import Link from 'next/link'
import useQueryParameter from '../../../hooks/useQueryParameter'
import { useQuery } from 'react-query'
import { dontRenderUntilQueryParametersReady } from '../../../utils/dontRenderUntilQueryParametersReady'
import { List, ListItem, Typography, Button } from '@material-ui/core'

function CoursePages() {
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
      <Typography>Course pages for {id}</Typography>
      {/* Insert new page stuff here */}
      <Button>New page</Button>
      <List>
        {data.map((page) => (
          <ListItem key={page.id}>
            <Link href="/pages/[id]" as={`/pages/${page.id}`}>
              {page.url_path}
            </Link>
          </ListItem>
        ))}
      </List>
    </Layout>
  )
}

export default dontRenderUntilQueryParametersReady(CoursePages)
