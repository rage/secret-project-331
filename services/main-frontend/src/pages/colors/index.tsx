import { css } from "@emotion/css"

import Layout from "../../components/Layout"
import { baseTheme } from "../../shared-module/styles"
import { frontendWideWidthCenteredComponentStyles } from "../../shared-module/styles/componentStyles"
import { respondToOrLarger } from "../../shared-module/styles/respond"

const Home: React.FC = () => {
  return (
    <Layout>
      <div className={frontendWideWidthCenteredComponentStyles}>
        <div
          className={css`
            display: grid;
            grid-template-columns: 1fr;
            ${respondToOrLarger.lg} {
              grid-template-columns: 0.3fr 0.3fr 0.3fr;
            }
            grid-gap: 30px;
          `}
        >
          {Object.entries(baseTheme.colors).map(([k, v]) => {
            return (
              <div key={k}>
                <h3>{k}</h3>
                {Object.entries(v).map(([key, val]) => {
                  return (
                    <div
                      key={key}
                      className={css`
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        height: 3em;
                        background-color: ${val};
                        padding: 0 1em;
                      `}
                    >
                      <div
                        className={css`
                          filter: invert(1);
                          mix-blend-mode: difference;
                        `}
                      >
                        {key}
                      </div>
                      <div
                        className={css`
                          filter: invert(1);
                          mix-blend-mode: difference;
                        `}
                      >
                        {val}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </Layout>
  )
}

export default Home
