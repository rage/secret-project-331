import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import contributecover from "../../img/contribute.png"
import Arrow from "../../img/screwedArrow.svg"
import { headingFont } from "../../styles"

// eslint-disable-next-line i18next/no-literal-string
const BannerWrapper = styled.div`
  height: 340px;
  position: relative;
  display: grid;
  justify-content: center;
  align-items: center;

  img {
    position: absolute;
    right: 0;
    top: 0;
    width: 100%;
    height: 340px;
    z-index: -1;
    object-fit: cover;
  }

  margin-bottom: 10px;
`
const Content = styled.div`
  font-weight: 500;
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 auto;
  max-width: 700px;
  text-align: center;
  padding-top: 30px;

  h2 {
    text-align: center;
    margin-bottom: 5px;
  }
`
const Text = styled.div`
  text-align: center;
  font-size: 22px;
  margin-bottom: 10px;

  div {
    color: #3b4754;
  }
`
// eslint-disable-next-line i18next/no-literal-string
const StyledLink = styled.a`
  font-family: ${headingFont};
  font-size: 30px;
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
const StyledArrow = styled(Arrow)`
  background: #dae6e5;
  width: 30px;
  height: 28px;
  border: 2px solid #8fb4b2;
  padding-left: 8px;
  padding-top: 7px;
`
export type ContributeProps = React.HTMLAttributes<HTMLDivElement>

const Contribute: React.FC<ContributeProps> = () => {
  const { t } = useTranslation()
  return (
    <BannerWrapper>
      <img src={contributecover} alt={t("contribute-image-cover")} />
      <Content>
        <h2>{t("contribute-to-this-ptoject")}</h2>
        <Text>
          <div>{t("contribute-to-this-project-description")}:</div>
        </Text>
        <StyledLink href="github.com/rage/secret-project-331">
          <span>{t("go-to-ptoject")}</span>
          <StyledArrow />
        </StyledLink>
      </Content>
    </BannerWrapper>
  )
}

export default Contribute
