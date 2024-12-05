import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import DynamicSvg from "./DynamicSvg"

import { fetchPartnersBlock } from "@/services/backend"

interface PartnersBlockProps {
  courseId: string | null
}

const PartnersSectionBlock: React.FC<PartnersBlockProps> = ({ courseId }) => {
  const getPartnersBlock = useQuery({
    queryKey: ["partners-block", courseId],
    queryFn: () => fetchPartnersBlock(courseId as NonNullable<string>),
  })

  const content =
    getPartnersBlock.isSuccess && Array.isArray(getPartnersBlock.data.content)
      ? getPartnersBlock.data.content
      : [] // Default to an empty array if content is not present

  const hasImages = content.some((block) => block.name === "core/image" && block.attributes.url)

  return (
    <>
      {hasImages && (
        <div
          data-test-id="partners-block"
          className={css`
            background: #f3f4f4;
            padding: 3rem 5rem;
            margin-bottom: -80px;
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            column-gap: 4rem;
            row-gap: 2rem;

            figure {
              margin: 0;

              img {
                width: 12rem;
                aspect-ratio: auto;
                margin: 0 !important;
                pointer-events: none;
              }
            }
          `}
        >
          {content.map((block) => {
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
