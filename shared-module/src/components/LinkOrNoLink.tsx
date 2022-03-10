import { css } from "@emotion/css"
import Link from "next/link"

import { baseTheme } from "../styles"

const LinkOrNoLink: React.FC<{ url: string | undefined }> = ({ url, children }) => {
  if (!url) {
    return <>{children}</>
  }
  return (
    <Link href={url} passHref>
      <a
        href="replace"
        className={css`
          text-decoration: none;
          &:focus-visible {
            outline: 2px solid ${baseTheme.colors.green[500]};
            outline-offset: 2px;
          }
        `}
      >
        {children}
      </a>
    </Link>
  )
}

export default LinkOrNoLink
