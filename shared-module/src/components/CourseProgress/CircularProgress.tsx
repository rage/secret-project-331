import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useLayoutEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSpring } from "react-spring"

import { baseTheme, headingFont, secondaryFont } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../../utils/constants"

import { CircularProgressExtraProps } from "."

const StyledSVG = styled.div`
  position: relative;
  width: 100%;
  text-align: center;
  height: auto;

  svg {
    margin: 0 auto;
    width: 16rem;
    transform: rotate(-90deg);
    transform-origin: 50% 50%;

    ${respondToOrLarger.sm} {
      width: 25rem;
    }
  }

  svg circle {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: #b4cdcb;
    stroke-width: 40px;
    transition: stroke-dashoffset 0.35s;
    transform: rotate(0deg);
  }

  svg circle:nth-child(2) {
    stroke: #b4cdcb;
  }

  svg circle:nth-child(3) {
    stroke: #1f6964;
  }

  p {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 2rem;
    line-height: 1.1;
    font-weight: 600;
    opacity: 0.9;
    font-family: ${headingFont};
    ${respondToOrLarger.sm} {
      font-size: 3rem;
    }
    span {
      opacity: 0.4;
    }
  }

  .points {
    font-size: 1.4rem;
    text-transform: uppercase;
    font-weight: 600;
    opacity: 0.5;
    font-family: ${secondaryFont};

    @media (max-width: 767.98px) {
      font-size: 1rem;
    }
  }
`
const CircularProgress: React.FC<CircularProgressExtraProps> = ({
  label,
  given,
  max,
  required,
}) => {
  const [willAnimate, setWillAnimate] = useState(false)
  const { t } = useTranslation()

  const givenScore = given ?? 0
  const maximum = max ?? 0

  const radius = 160
  const circumference = 2 * Math.PI * radius
  const receivedPointsRatio = givenScore / maximum
  const requiredForCompletionRatio = required && required > 0 && max && max > 0 ? required / max : 0

  const receivedPointsStrokeDashOffset = (1 - receivedPointsRatio) * circumference
  const requiredForCompletionStrokeDashOffset = (1 - requiredForCompletionRatio) * circumference

  useLayoutEffect(() => {
    const onScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight
      if (scrollPosition > 1700) {
        setWillAnimate(true)
      }
    }

    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useSpring({
    number: !willAnimate ? 0 : givenScore,
    config: { duration: 1000 },
  })
  return (
    <>
      <h2
        className={cx(
          INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS,
          css`
            padding-bottom: 14px;
            font-weight: 500;
            font-size: 1.8rem;
            border-bottom: 3px solid #e2e4e6;
            color: ${baseTheme.colors.green[700]};
          `,
        )}
      >
        {label}
      </h2>
      <StyledSVG>
        <svg xmlns="http://www.w3.org/2000/svg" width="497" height="497" viewBox="0 0 497 497">
          <g id="Group_11" transform="translate(-712 -7629)">
            <g id="Ellipse_2" transform="translate(712 7629)" fill="#edf2f4">
              <path
                d="M 248.5 496 C 231.7068176269531 496 214.9244384765625 494.3082580566406 198.6190643310547 490.9716796875 C 182.7286224365234 487.7200012207031 167.0982513427734 482.8680725097656 152.1621246337891 476.5506286621094 C 137.4969329833984 470.3478088378906 123.3523101806641 462.6703186035156 110.1211242675781 453.7315063476563 C 97.01531219482422 444.8773803710938 84.69118499755859 434.7090759277344 73.49106597900391 423.5089416503906 C 62.29093933105469 412.3088073730469 52.12262344360352 399.9846801757813 43.26850128173828 386.8788757324219 C 34.32968902587891 373.6476745605469 26.65218734741211 359.5030517578125 20.44937515258789 344.8378601074219 C 14.13193702697754 329.9017639160156 9.279999732971191 314.2713623046875 6.028312683105469 298.3809509277344 C 2.691750049591064 282.0755615234375 1 265.2931823730469 1 248.5 C 1 231.7068176269531 2.691750049591064 214.9244384765625 6.028312683105469 198.6190643310547 C 9.279999732971191 182.7286224365234 14.13193702697754 167.0982513427734 20.44937515258789 152.1621246337891 C 26.65218734741211 137.4969329833984 34.32968902587891 123.3523101806641 43.26850128173828 110.1211242675781 C 52.12262344360352 97.01531219482422 62.29093933105469 84.69118499755859 73.49106597900391 73.49106597900391 C 84.69118499755859 62.29093933105469 97.01531219482422 52.12262344360352 110.1211242675781 43.26850128173828 C 123.3523101806641 34.32968902587891 137.4969329833984 26.65218734741211 152.1621246337891 20.44937515258789 C 167.0982513427734 14.13193702697754 182.7286224365234 9.279999732971191 198.6190643310547 6.028312683105469 C 214.9244384765625 2.691750049591064 231.7068176269531 1 248.5 1 C 265.2931823730469 1 282.0755615234375 2.691750049591064 298.3809509277344 6.028312683105469 C 314.2713623046875 9.279999732971191 329.9017639160156 14.13193702697754 344.8378601074219 20.44937515258789 C 359.5030517578125 26.65218734741211 373.6476745605469 34.32968902587891 386.8788757324219 43.26850128173828 C 399.9846801757813 52.12262344360352 412.3088073730469 62.29093933105469 423.5089416503906 73.49106597900391 C 434.7090759277344 84.69118499755859 444.8773803710938 97.01531219482422 453.7315063476563 110.1211242675781 C 462.6703186035156 123.3523101806641 470.3478088378906 137.4969329833984 476.5506286621094 152.1621246337891 C 482.8680725097656 167.0982513427734 487.7200012207031 182.7286224365234 490.9716796875 198.6190643310547 C 494.3082580566406 214.9244384765625 496 231.7068176269531 496 248.5 C 496 265.2931823730469 494.3082580566406 282.0755615234375 490.9716796875 298.3809509277344 C 487.7200012207031 314.2713623046875 482.8680725097656 329.9017639160156 476.5506286621094 344.8378601074219 C 470.3478088378906 359.5030517578125 462.6703186035156 373.6476745605469 453.7315063476563 386.8788757324219 C 444.8773803710938 399.9846801757813 434.7090759277344 412.3088073730469 423.5089416503906 423.5089416503906 C 412.3088073730469 434.7090759277344 399.9846801757813 444.8773803710938 386.8788757324219 453.7315063476563 C 373.6476745605469 462.6703186035156 359.5030517578125 470.3478088378906 344.8378601074219 476.5506286621094 C 329.9017639160156 482.8680725097656 314.2713623046875 487.7200012207031 298.3809509277344 490.9716796875 C 282.0755615234375 494.3082580566406 265.2931823730469 496 248.5 496 Z"
                stroke="none"
              />
              <path
                d="M 248.5 2 C 231.7739868164063 2 215.0590515136719 3.6849365234375 198.8195495605469 7.008056640625 C 182.9937438964844 10.24642944335938 167.427001953125 15.07861328125 152.5516967773438 21.370361328125 C 137.9460144042969 27.54806518554688 123.8586120605469 35.19442749023438 110.6808776855469 44.09713745117188 C 97.62786865234375 52.91561889648438 85.35330200195313 63.04306030273438 74.19818115234375 74.19818115234375 C 63.04306030273438 85.35330200195313 52.91561889648438 97.62786865234375 44.09713745117188 110.6808776855469 C 35.19442749023438 123.8586120605469 27.54806518554688 137.9460144042969 21.370361328125 152.5516967773438 C 15.07861328125 167.427001953125 10.24642944335938 182.9937438964844 7.008056640625 198.8195495605469 C 3.6849365234375 215.0590515136719 2 231.7739868164063 2 248.5 C 2 265.2260131835938 3.6849365234375 281.94091796875 7.008056640625 298.180419921875 C 10.24642944335938 314.0062561035156 15.07861328125 329.572998046875 21.370361328125 344.4483032226563 C 27.54806518554688 359.0540161132813 35.19442749023438 373.141357421875 44.09713745117188 386.3191223144531 C 52.91561889648438 399.3721313476563 63.04306030273438 411.6466979980469 74.19818115234375 422.8018188476563 C 85.35330200195313 433.9569396972656 97.62786865234375 444.0843811035156 110.6808776855469 452.9028625488281 C 123.8586120605469 461.8055725097656 137.9460144042969 469.4519348144531 152.5516967773438 475.629638671875 C 167.427001953125 481.92138671875 182.9937438964844 486.7535705566406 198.8195495605469 489.991943359375 C 215.0590515136719 493.3150634765625 231.7739868164063 495 248.5 495 C 265.2260131835938 495 281.94091796875 493.3150634765625 298.180419921875 489.991943359375 C 314.0062561035156 486.7535705566406 329.572998046875 481.92138671875 344.4483032226563 475.629638671875 C 359.0540161132813 469.4519348144531 373.141357421875 461.8055725097656 386.3191223144531 452.9028625488281 C 399.3721313476563 444.0843811035156 411.6466979980469 433.9569396972656 422.8018188476563 422.8018188476563 C 433.9569396972656 411.6466979980469 444.0843811035156 399.3721313476563 452.9028625488281 386.3191223144531 C 461.8055725097656 373.141357421875 469.4519348144531 359.0540161132813 475.629638671875 344.4483032226563 C 481.92138671875 329.572998046875 486.7535705566406 314.0062561035156 489.991943359375 298.180419921875 C 493.3150634765625 281.94091796875 495 265.2260131835938 495 248.5 C 495 231.7739868164063 493.3150634765625 215.0590515136719 489.991943359375 198.8195495605469 C 486.7535705566406 182.9937438964844 481.92138671875 167.427001953125 475.629638671875 152.5516967773438 C 469.4519348144531 137.9460144042969 461.8055725097656 123.8586120605469 452.9028625488281 110.6808776855469 C 444.0843811035156 97.62786865234375 433.9569396972656 85.35330200195313 422.8018188476563 74.19818115234375 C 411.6466979980469 63.04306030273438 399.3721313476563 52.91561889648438 386.3191223144531 44.09713745117188 C 373.141357421875 35.19442749023438 359.0540161132813 27.54806518554688 344.4483032226563 21.370361328125 C 329.572998046875 15.07861328125 314.0062561035156 10.24642944335938 298.180419921875 7.008056640625 C 281.94091796875 3.6849365234375 265.2260131835938 2 248.5 2 M 248.5 0 C 385.7427368164063 0 497 111.2572631835938 497 248.5 C 497 385.7427368164063 385.7427368164063 497 248.5 497 C 111.2572631835938 497 0 385.7427368164063 0 248.5 C 0 111.2572631835938 111.2572631835938 0 248.5 0 Z"
                stroke="none"
                fill="#edf2f4"
              />
            </g>
            <g
              id="Ellipse_1"
              transform="translate(801 7718)"
              fill="#fff"
              stroke={`${baseTheme.colors.green[700]}`}
              strokeLinecap="round"
            >
              <circle cx="160" cy="160" r="160" />
              <circle
                cx={radius}
                cy={radius}
                r={radius}
                className={css`
                  stroke-dasharray: ${circumference} ${circumference * 2};
                  stroke-dashoffset: ${requiredForCompletionStrokeDashOffset};
                `}
              />
              <circle
                cx={radius}
                cy={radius}
                r={radius}
                className={css`
                  stroke-dasharray: ${circumference} ${circumference * 2};
                  stroke-dashoffset: ${receivedPointsStrokeDashOffset};
                `}
              />
            </g>
          </g>
        </svg>
        <p>
          {givenScore}
          {"/"}
          <span>{maximum}</span>
          <br />
          <span className="points">{t("points")}</span>
        </p>
      </StyledSVG>
    </>
  )
}

export default CircularProgress
