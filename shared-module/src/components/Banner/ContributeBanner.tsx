import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont } from "../../styles"

// eslint-disable-next-line i18next/no-literal-string
const BannerWrapper = styled.div`
  height: 300px;
  position: relative;
  display: grid;
  justify-content: center;
  align-items: center;
  background: #f9f9f9;
  margin-top: 5rem;

  .svgwrapper {
    display: flex;
    position: absolute;
    right: 0;
    top: 0;
    width: 100%;
    height: 250px;
    z-index: -1;
  }

  .cover {
    width: 100%;
    height: 100%;
  }
`
const Content = styled.div`
  font-weight: 500;
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 auto;
  max-width: 700px;
  text-align: center;

  h2 {
    font-size: clamp(24px, 3vw, 50px);
    font-family: ${headingFont};
    font-weight: 700;
    text-align: center;
    margin-bottom: 5px !important;

    background: -webkit-linear-gradient(-70deg, #a2facf 0%, #64acff 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
`
const Text = styled.div`
  text-align: center;
  font-size: 18px;
  margin-bottom: 10px;

  div {
    color: #1a2333;
    opacity: 0.7;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const StyledLink = styled.a`
  font-family: ${headingFont};
  font-size: 20px;
  color: #44827e;
  text-decoration: none;

  span {
    padding-bottom: 10px;
    position: relative;
    margin-right: 10px;
  }

  span::after {
    content: "";

    width: 100%;
    position: absolute;
    left: 0;
    bottom: 5px;

    border-width: 0 0 3px;
    border-style: solid;
  }
`
export type ContributeProps = React.HTMLAttributes<HTMLDivElement>

const Contribute: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ContributeProps>>
> = () => {
  const { t } = useTranslation()
  return (
    <BannerWrapper>
      <div className="svgwrapper"></div>
      <Content>
        <h2>{t("about-this-project")}</h2>
        <Text>
          <div>{t("about-this-project-description")}</div>
        </Text>
        <StyledLink href="https://github.com/rage/secret-project-331">
          <span>{t("project-github")}</span>
        </StyledLink>
      </Content>
    </BannerWrapper>
  )
}

export default Contribute
