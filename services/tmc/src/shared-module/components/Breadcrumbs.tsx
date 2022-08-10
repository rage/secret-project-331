import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import Link from "next/link"
import { useTranslation } from "react-i18next"

const StyledBreadcrumb = styled.div`
  font-size: 1rem;
  margin: 0;

  .breadcrumb {
    font-size: 16px;
    .list {
      margin: 0.5rem 0;
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
  color: #696e77;
  text-decoration: none !important;

  &:hover {
    color: #1a2333;
  }
`
const breadCrumbText = css`
  color: #1a2333;
  font-size: 16px;
`

export interface BreakcrumbProps {
  pieces: BreadcrumbPiece[]
}

export interface BreadcrumbPiece {
  text: string
  url: string
  externalLink?: boolean
}

const MARKER = "›"

const Breadcrumbs: React.FC<BreakcrumbProps> = ({ pieces }) => {
  const { t } = useTranslation()

  return (
    <StyledBreadcrumb>
      <div className={cx(wrapper)}>
        <nav className="breadcrumb" aria-label={t("breadcrumb")}>
          <ol className="list">
            {pieces.map((piece, index) => {
              const isLast = index === pieces.length - 1
              return isLast ? (
                <li key={piece.url} className="group">
                  <span className={cx(breadCrumbText)} aria-current="page">
                    {piece.text}
                  </span>
                </li>
              ) : (
                <li key={piece.url} className="group">
                  {piece.externalLink ? (
                    <a href={piece.url} className={cx(breadCrumbText, link)}>
                      {piece.text}
                    </a>
                  ) : (
                    <Link href={piece.url}>
                      <a href={piece.url} className={cx(breadCrumbText, link)}>
                        {piece.text}
                      </a>
                    </Link>
                  )}
                  <span className="arrow" aria-hidden="true">
                    {MARKER}
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

export default Breadcrumbs
