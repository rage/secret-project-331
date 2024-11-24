import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"

import DynamicSvg from "./DynamicSvg"

import { fetchPartnersBlock } from "@/services/backend"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

interface PartnersBlockProps {
  courseId: string | null
}

const PartnersSectionBlock: React.FC<PartnersBlockProps> = ({ courseId }) => {
  const getPartnersBlock = useQuery({
    queryKey: ["partners-block", courseId],
    queryFn: () => fetchPartnersBlock(courseId as NonNullable<string>),
    enabled: courseId !== null,
  })

  useEffect(() => {
    getPartnersBlock.refetch()
  }, [courseId, getPartnersBlock])

  const hasImages =
    getPartnersBlock.isSuccess &&
    getPartnersBlock.data.content.some(
      (block) => block.name === "core/image" && block.attributes.url,
    )

  return (
    <>
      {getPartnersBlock.isError && (
        <ErrorBanner variant={"readOnly"} error={getPartnersBlock.error} />
      )}
      {getPartnersBlock.isPending && <Spinner variant={"medium"} />}
      {hasImages && (
        <div
          className={css`
            background: #f3f4f4;
            padding: 3rem 5rem;
            margin-bottom: -80px;
            display: flex;
            justify-content: center;
            align-items: center;
            column-gap: 4rem;

            figure {
              width: 5rem;
              aspect-ratio: 1/1;
              margin: 0;

              img {
                margin: 0 !important;
                pointer-events: none;
              }
            }
          `}
        >
          {getPartnersBlock.data.content.map((block) => {
            if (block.name === "core/image" && block.attributes.url) {
              const { url, alt, href, linkDestination } = block.attributes

              // Ensure that the link is always a full URL (https://)
              // eslint-disable-next-line i18next/no-literal-string
              const formattedLink = href && !/^https?:\/\//i.test(href) ? `https://${href}` : href
              const isSvgUrl = url.endsWith(".svg")

              // Conditionally return image wrapped in a link or just the image based on whether 'link' is available
              return linkDestination == "custom" ? (
                <a
                  key={block.clientId}
                  href={formattedLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {isSvgUrl ? (
                    <DynamicSvg src={url} />
                  ) : (
                    <figure>
                      <img src={url} alt={alt} />
                    </figure>
                  )}
                </a>
              ) : isSvgUrl ? (
                <DynamicSvg src={url} />
              ) : (
                <figure>
                  <img src={url} alt={alt} />
                </figure>
              )
            }
          })}
        </div>
      )}
    </>
  )
}

export default PartnersSectionBlock
