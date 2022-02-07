/* eslint-disable i18next/no-literal-string */
import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useRouter } from "next/router"

import { BreadcrumbPiece } from "."

const StyledBreadcrumb = styled.nav`
  font-size: 1rem;
  margin: 0;

  .breadcrumb {
    font-size: 22px;
    .list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .group {
      display: inline-flex;
      align-items: center;
    }

    .arrow {
      margin-left: 0.75rem;
      color: #333;
    }
  }
`

const wrapper = css`
  padding: 1rem 2rem;
  background-color: #f1f1f1;
  color: #fff;
  border-radius: 2px;

  &:nth-of-type(n + 2) {
    margin-top: 2.5rem;
  }
`

const link = css`
  color: #989ca3;
  text-decoration: none !important;

  &:hover {
    color: #1a2333;
  }
`
const breadCrumbText = css`
  color: #1a2333;
  font-size: 22px;
`

const Breadcrumb: React.FC<BreadcrumbPiece> = (props) => {
  let { url } = props

  const navigate = useRouter()

  url = "/jobs/IT/softwareEngineer/FE"
  const pathnames = url.split("/").filter((path) => path)
  const HOME = "Home"

  return (
    <StyledBreadcrumb aria-label="breadcrumb">
      <div className={cx(wrapper)}>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <ol className="list">
            {pathnames.length > 0 ? (
              <li className="group">
                <a href="#0" className={cx(breadCrumbText, link)}>
                  {HOME}
                </a>
                <span className="arrow" aria-hidden="true">
                  ›
                </span>
              </li>
            ) : (
              <li className="group">
                <span className={cx(breadCrumbText)} aria-current="page">
                  {HOME}
                </span>
              </li>
            )}
            {pathnames.map((name, index) => {
              const route = `/${pathnames.slice(0, index + 1).join("/")}`
              const isLast = index === pathnames.length - 1
              return isLast ? (
                <li className="group">
                  <span className={cx(breadCrumbText)} aria-current="page">
                    {name}
                  </span>
                </li>
              ) : (
                <li className="group">
                  <a
                    href="#0"
                    className={cx(breadCrumbText, link)}
                    onClick={() => navigate.push(route)}
                  >
                    {name}
                  </a>
                  <span className="arrow" aria-hidden="true">
                    ›
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>
    </StyledBreadcrumb>
  )
}

export default Breadcrumb
