// Modified from https://github.com/vineethtrv/css-loader, MIT
import { css } from "@emotion/css"

const ThinkingIndicator = () => {
  return (
    <span
      className={css`
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        max-width: 1rem;

        &::before,
        &::after {
          content: "";
          position: absolute;
          border-radius: 50%;
          animation: pulsOut 1.8s ease-in-out infinite;
          filter: drop-shadow(0 0 1rem rgba(255, 255, 255, 0.75));
        }
        &::before {
          width: 100%;
          padding-bottom: 100%;
          box-shadow: inset 0 0 0 1rem #fff;
          animation-name: pulsIn;
        }
        &::after {
          width: calc(100% - 2rem);
          padding-bottom: calc(100% - 2rem);
          box-shadow: 0 0 0 0 #fff;
        }

        @keyframes pulsIn {
          0% {
            box-shadow: inset 0 0 0 1rem #fff;
            opacity: 1;
          }
          50%,
          100% {
            box-shadow: inset 0 0 0 0 #fff;
            opacity: 0;
          }
        }

        @keyframes pulsOut {
          0%,
          50% {
            box-shadow: 0 0 0 0 #fff;
            opacity: 0;
          }
          100% {
            box-shadow: 0 0 0 1rem #fff;
            opacity: 1;
          }
        }
      `}
    ></span>
  )
}

export default ThinkingIndicator
