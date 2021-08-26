import styled from "@emotion/styled"
import React from "react"

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
    color: #333;
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
    color: #333;
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
  content: string
}

export type BannerProps = React.HTMLAttributes<HTMLDivElement> & BannerExtraProps

const Banner: React.FC<BannerProps> = ({ content, variant }, props) => {
  return (
    <BannerWrapper {...props}>
      <Content>
        <Text>
          <h2>Data Not Found</h2>
          <p>This is because one of our backend developers was sleeping on duty</p>
        </Text>
        <DetailTag>
          <details>
            <summary>Show source</summary>
            <ul>
              <li>
                Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem
                Ipsum has been the industrys standard dummy text ever since the 1500s, when an
                unknown printer took a galley of type and scrambled it to make a type specimen book.
                It has survived not only five centuries, but also the leap into electronic
                typesetting, remaining essentially unchanged. It was popularised in the 1960s with
                the release of Letraset sheets containing Lorem Ipsum passages, and more recently
                with desktop publishing software like Aldus PageMaker including versions of Lorem
                Ipsum
              </li>
            </ul>
          </details>
        </DetailTag>
      </Content>
    </BannerWrapper>
  )
}

export default Banner
