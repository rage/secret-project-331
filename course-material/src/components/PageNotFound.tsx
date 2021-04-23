import { Alert, AlertTitle } from "@material-ui/lab"
import React from "react"
import PublicPageList from "./PublicPageList"

interface PageNotFoundProps {
  path: string
  courseId: string
}

const PageNotFound: React.FC<PageNotFoundProps> = ({ path, courseId }) => {
  return (
    <>
      <Alert severity="error">
        <AlertTitle>404 Not Found</AlertTitle>
        This course has no page at <code>{path}</code>.
      </Alert>
      {path === "/" && (
        <>
          <p>
            If you are the author of this course, please create a front page for the course with
            path <code>/</code>.
          </p>
          {<PublicPageList courseId={courseId} />}
        </>
      )}
    </>
  )
}

export default PageNotFound
