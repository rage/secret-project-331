import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { ErrorResponse } from "../bindings"
import { isErrorResponse } from "../bindings.guard"
import { baseTheme } from "../styles"

const BannerWrapper = styled.div`
  background: #f1f1f1;
  width: 100%;
  position: relative;
  margin: 0 auto;
  display: block;
  border-left: 4px solid #da4453;
`

const Content = styled.div`
  padding-top: 2rem;
  max-width: 100%;
  font-weight: 500;
  font-size: 1rem;
  line-height: 1.4;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;

  a {
    text-decoration: none;
    max-width: 100%;
    cursor: pointer;
    display: flex;
    height: 1rem;
    line-height: 1rem;
    margin-top: 1rem;

    span {
      display: flex;
      align-items: center;
      margin-left: 0.5rem;
    }
  }
`
const Text = styled.div`
  padding: 0 2rem;
`
const DetailTag = styled.div`
  background: #e1e1e1;
  details {
    padding: 0 2rem;
  }

  details[open] summary ~ * {
    color: ${baseTheme.colors.grey[800]};
  }

  details[open] > div {
    animation-duration: 0.3s;
    animation-fill-mode: forwards;
  }

  details summary {
    padding: 1rem 0;
    position: relative;
    cursor: pointer;
    font-size: 1.1rem;
    font-weight: medium;
    list-style: none;
    color: ${baseTheme.colors.grey[800]};
    outline: 0;
  }

  details summary::-webkit-details-marker {
    display: none;
  }

  details[open] > summary {
    color: #1c1c1c;
  }

  details[open] summary {
    opacity: 0.9;
  }

  ul {
    padding: 0;
    margin: 0;
    padding-bottom: 2rem;
  }

  ul li {
    font-size: 1.1rem;
    margin: 0 0 0.2rem;
    padding: 15px 30px;
    line-height: 1.7;
    list-style: none;
    background: #e3e3e3;
    border: 2px solid #c1c1c1;
    border-radius: 10px;
  }
`

export interface BannerExtraProps {
  variant: "text" | "link" | "readOnly"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: any
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const Banner: React.FC<BannerProps> = (props) => {
  const { t } = useTranslation()
  const { error } = props
  if (typeof error === "object" && error !== null) {
    if (isErrorResponse(error.data)) {
      // response data contains an error response
      const data: ErrorResponse = error.data
      return (
        <BannerWrapper>
          <Content>
            <Text>
              <h2>
                {t("error-title")} {error.status}: {data.title}
              </h2>
              <p>{data.message}</p>
            </Text>
            <DetailTag>
              {data.source && (
                <details>
                  <summary>{t("show-error-source")}</summary>
                  <ul>
                    <li>
                      <pre>{data.source}</pre>
                    </li>
                  </ul>
                </details>
              )}
            </DetailTag>
          </Content>
        </BannerWrapper>
      )
    } else if (
      error.status !== undefined &&
      error.statusText !== undefined &&
      typeof error.request === "object" &&
      error.request.responseURL !== undefined
    ) {
      // error contains a response but no ErrorResponse
      return (
        <BannerWrapper>
          <Content>
            <Text>
              <h2>
                {t("error-title")} {error.status}: {error.statusText}
              </h2>
              <p>{error.request.responseURL}</p>
            </Text>
            <DetailTag>
              {error.data && (
                <details>
                  <summary>{t("show-error-source")}</summary>
                  <ul>
                    <li>{<pre>{JSON.stringify(error.data, undefined, 2)}</pre>}</li>
                  </ul>
                </details>
              )}
            </DetailTag>
          </Content>
        </BannerWrapper>
      )
    }
  }

  // Error very much unknown
  return (
    <BannerWrapper>
      <Content>
        <Text>
          <h2>{t("error-title")}</h2>
        </Text>
        <DetailTag>
          <details>
            <summary>{t("show-error-source")}</summary>
            <ul>
              <li>
                <pre>{JSON.stringify(error, undefined, 2)}</pre>
              </li>
            </ul>
          </details>
        </DetailTag>
      </Content>
    </BannerWrapper>
  )
}

export default Banner
