import Link from "next/link"

const LinkOrNoLink: React.FC<{ url: string | undefined; linkClassName?: string }> = ({
  url,
  children,
  linkClassName,
}) => {
  if (!url) {
    return <>{children}</>
  }
  return (
    <Link href={url} passHref>
      <a href="replace" className={linkClassName}>
        {children}
      </a>
    </Link>
  )
}

export default LinkOrNoLink
