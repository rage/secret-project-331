import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Arrow from "../../img/screwedArrow.svg"
import { headingFont } from "../../styles"

const Cover = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="cover"
    width="1920"
    height="257"
    viewBox="0 0 1920 257"
    preserveAspectRatio="xMidYMid slice"
  >
    <rect className="cover" width="1920" height="257" fill="#f9f9f9" />
    <path
      d="M1326.5,132a35.5,35.5,0,1,0,25.1,10.4A35.5,35.5,0,0,0,1326.5,132Zm0,67.175a31.587,31.587,0,1,1,22.32-9.253A31.571,31.571,0,0,1,1326.5,199.175Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M1326.5,140.491a27.018,27.018,0,1,0,10.34,2.052A26.991,26.991,0,0,0,1326.5,140.491Zm0,50.192a23.087,23.087,0,1,1,16.32-6.764A23.095,23.095,0,0,1,1326.5,190.683Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M1326.49,150.509a17.131,17.131,0,1,0,12.08,5.015A17.066,17.066,0,0,0,1326.49,150.509Zm0,30.157a13.2,13.2,0,0,1-12.17-8.132,13.163,13.163,0,0,1,2.86-14.357,13.165,13.165,0,1,1,9.31,22.489Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M512,41a15,15,0,1,0,10.607,4.393A15,15,0,0,0,512,41Zm0,28.384a13.349,13.349,0,1,1,9.431-3.91A13.339,13.339,0,0,1,512,69.384Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M512,44.588a11.4,11.4,0,1,0,4.369.867A11.415,11.415,0,0,0,512,44.588ZM512,65.8a9.758,9.758,0,1,1,6.894-2.858A9.752,9.752,0,0,1,512,65.8Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M512,48.82a7.235,7.235,0,1,0,5.1,2.119A7.223,7.223,0,0,0,512,48.82Zm0,12.742a5.586,5.586,0,1,1,3.93-1.636A5.569,5.569,0,0,1,512,61.563Z"
      fill="rgba(35,146,120,0.2)"
    />
    <path
      d="M326.664,59.8l-31.311,54.173L282.92,106.79l31.3-54.17Z"
      fill="rgba(26,35,51,0.1)"
      fillRule="evenodd"
    />
    <path
      d="M335.483,92.708,328.3,105.144,274.1,73.882l7.179-12.434Z"
      fill="rgba(26,35,51,0.1)"
      fillRule="evenodd"
    />
    <path
      d="M498.492,135.561,529.2,188.8l-12.213,7.051-30.706-53.229Z"
      fill="rgba(6,88,83,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M530.819,144.222l7.048,12.222L484.66,187.188l-7.051-12.212Z"
      fill="rgba(6,88,83,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M130.863,135.615l19.222,33.329-7.645,4.414-19.224-33.323Z"
      fill="rgba(158,52,31,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M151.1,141.037l4.413,7.652L122.2,167.936l-4.414-7.646Z"
      fill="rgba(158,52,31,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1733.47,140.58l30.7,53.238-12.21,7.051-30.71-53.229Z"
      fill="rgba(81,48,159,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1765.79,149.242l7.05,12.221-53.21,30.745-7.05-12.213Z"
      fill="rgba(81,48,159,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1537.55,67.938l-35.48,61.4-14.1-8.136,35.48-61.4Z"
      fill="rgba(8,69,122,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1547.55,105.242l-8.15,14.1L1477.98,83.9l8.14-14.093Z"
      fill="rgba(8,69,122,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M734.53,133.115l11.185,55.8-12.8,2.573L721.722,135.7Z"
      fill="rgba(26,35,51,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M760.332,150.284l2.567,12.81-55.786,11.229-2.572-12.8Z"
      fill="rgba(26,35,51,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1224.03,53.908,1193.91,84,1187,77.091,1217.11,47Z"
      fill="rgba(224,195,65,0.2)"
      fillRule="evenodd"
    />
    <path
      d="M1224.03,77.093,1217.11,84,1187,53.91,1193.91,47Z"
      fill="rgba(224,195,65,0.2)"
      fillRule="evenodd"
    />
    <path d="M589.474,69.7l9.4,9.023-12.947,3.409Z" fill="rgba(81,48,159,0.2)" />
    <path d="M593.526,84.3l-9.4-9.024,12.948-3.407Z" fill="rgba(81,48,159,0.2)" />
    <path d="M214.474,214.705l9.4,9.023-12.947,3.408Z" fill="rgba(64,161,139,0.2)" />
    <path d="M218.526,229.3l-9.4-9.024,12.948-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M322.474,166.705l9.4,9.023-12.947,3.408Z" fill="rgba(8,69,122,0.2)" />
    <path d="M326.526,181.3l-9.4-9.024,12.948-3.407Z" fill="rgba(8,69,122,0.2)" />
    <path d="M197.474,59.7l9.4,9.023-12.947,3.409Z" fill="rgba(64,161,139,0.2)" />
    <path d="M201.526,74.3l-9.4-9.024,12.948-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1084.47,171.705l9.41,9.023-12.95,3.408Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1088.53,186.3l-9.4-9.024,12.94-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M937.474,89.7l9.4,9.023-12.947,3.408Z" fill="rgba(158,52,31,0.2)" />
    <path d="M941.526,104.3l-9.4-9.024,12.948-3.407Z" fill="rgba(158,52,31,0.2)" />
    <path d="M818.474,199.705l9.4,9.023-12.947,3.408Z" fill="rgba(64,161,139,0.2)" />
    <path d="M822.526,214.3l-9.4-9.024,12.948-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1368.47,62.71l9.41,9.023-12.95,3.409Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1372.53,77.3l-9.4-9.024,12.94-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1593.47,130.705l9.41,9.023-12.95,3.408Z" fill="rgba(26,35,51,0.2)" />
    <path d="M1597.53,145.3l-9.4-9.024,12.94-3.407Z" fill="rgba(26,35,51,0.2)" />
    <path d="M1696.47,58.7l9.41,9.023-12.95,3.409Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1700.53,73.3l-9.4-9.024,12.94-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1851.47,159.705l9.41,9.023-12.95,3.408Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1855.53,174.3l-9.4-9.024,12.94-3.407Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1481.47,159.705l9.41,9.023-12.95,3.408Z" fill="rgba(158,52,31,0.2)" />
    <path d="M1485.53,174.3l-9.4-9.024,12.94-3.407Z" fill="rgba(158,52,31,0.2)" />
    <path d="M1591.96,197.041l5.74,5.514-7.91,2.084Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1594.43,205.959l-5.74-5.515,7.91-2.082Z" fill="rgba(64,161,139,0.2)" />
    <path d="M1620.96,47.041l5.74,5.514-7.91,2.083Z" fill="rgba(81,48,159,0.2)" />
    <path d="M1623.43,55.959l-5.74-5.515,7.91-2.082Z" fill="rgba(81,48,159,0.2)" />
    <path d="M1200.47,209.705l9.41,9.023-12.95,3.408Z" fill="rgba(8,69,122,0.2)" />
    <path d="M1204.53,224.3l-9.4-9.024,12.94-3.407Z" fill="rgba(8,69,122,0.2)" />
    <path d="M686.52,49.552l13.827,13.512-19.04,5.1Z" fill="rgba(64,161,139,0.2)" />
    <path d="M692.48,71.4,678.655,57.89l19.04-5.1Z" fill="rgba(64,161,139,0.2)" />
  </svg>
)

// eslint-disable-next-line i18next/no-literal-string
const BannerWrapper = styled.div`
  height: 250px;
  position: relative;
  display: grid;
  justify-content: center;
  align-items: center;

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

  margin-bottom: 10px;
`
const Content = styled.div`
  font-weight: 500;
  font-size: 1.2rem;
  line-height: 1.4;
  margin: 0 auto;
  max-width: 700px;
  text-align: center;

  h2 {
    font-size: clamp(24px, 3vw, 30px);
    font-family: ${headingFont};
    font-weight: bold;
    color: #065853;
    text-align: center;
    margin-bottom: 5px !important;
  }
`
const Text = styled.div`
  text-align: center;
  font-size: 18px;
  margin-bottom: 10px;

  div {
    color: #3b4754;
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
      <div className="svgwrapper">
        <Cover />
      </div>
      <Content>
        <h2>{t("about-this-project")}</h2>
        <Text>
          <div>{t("about-this-project-description")}</div>
        </Text>
        <StyledLink href="https://github.com/rage/secret-project-331">
          <span>{t("project-github")}</span>
          <StyledArrow />
        </StyledLink>
      </Content>
    </BannerWrapper>
  )
}

export default Contribute
