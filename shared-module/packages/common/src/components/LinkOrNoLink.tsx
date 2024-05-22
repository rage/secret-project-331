import Link from "next/link"

const LinkOrNoLink: React.FC<
  React.PropsWithChildren<
    React.PropsWithChildren<{ url: string | undefined; linkClassName?: string }>
  >
> = ({ url, children, linkClassName }) => {
  if (!url) {
    return <>{children}</>
  }
  return (
    <Link href={url} className={linkClassName}>
      {children}
    </Link>
  )
}

export default LinkOrNoLink
