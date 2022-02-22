import { css } from "@emotion/css"
import Link from "next/link"

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
        `}
      >
        {children}
      </a>
    </Link>
  )
}

export default LinkOrNoLink
