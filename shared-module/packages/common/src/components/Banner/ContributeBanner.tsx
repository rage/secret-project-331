import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../../styles"

const BannerWrapper = styled.div`
  height: 300px;
  position: relative;
  display: grid;
  justify-content: center;
  align-items: center;
  background: #f6f8fa;
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
    font-size: clamp(35px, 4vw, 56px);
    font-family: ${headingFont};
    font-weight: 700;
    text-align: center;
    margin-bottom: 5px !important;

    background: -webkit-linear-gradient(-70deg, #020344 0%, #28b8d5 100%);
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
    color: ${baseTheme.colors.gray[700]};
    opacity: 0.8;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const StyledLink = styled.a`
  font-family: ${headingFont};
  font-size: 20px;
  color: #1f6964;
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

const GITHUB_REPO = "https://github.com/rage/secret-project-331"

const Contribute: React.FC<React.PropsWithChildren<ContributeProps>> = () => {
  const { t } = useTranslation()
  return (
    <BannerWrapper>
      <div className="svgwrapper"></div>
      <Content>
        <h2>{t("about-this-project")}</h2>
        <Text>
          <div>{t("about-this-project-description")}</div>
        </Text>
        <StyledLink href={GITHUB_REPO}>
          <span>{t("project-github")}</span>
        </StyledLink>
      </Content>
    </BannerWrapper>
  )
}

export default Contribute
