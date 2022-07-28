/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"
import Particles from "react-tsparticles"

import Tick from "../img/tick.svg"

const StyledDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100% !important;
  height: 100% !important;

  #tsparticles {
    height: 100% !important;
  }
`

const Confetti: React.FC<React.PropsWithChildren<unknown>> = () => {
  return (
    <StyledDiv>
      <Particles
        id="tsparticles"
        options={{
          background: {
            color: {
              value: "transparent",
            },
          },
          interactivity: {
            detectsOn: "window",
          },
          emitters: {
            position: {
              x: 50,
              y: 100,
            },
            rate: {
              quantity: 10,
              delay: 0.25,
            },
          },
          particles: {
            color: {
              value: ["#7b5cff", "#6245e0", "#b3c7ff", "#8fa5e5", "#5c86ff", "#345dd1"],
            },
            move: {
              decay: 0.05,
              direction: "top",
              enable: true,
              gravity: {
                enable: true,
                maxSpeed: 140,
              },
              outModes: {
                top: "none",
                default: "destroy",
              },
              speed: { min: 25, max: 50 },
            },
            number: {
              value: 0,
            },
            opacity: {
              value: 1,
            },
            rotate: {
              value: {
                min: 0,
                max: 180,
              },
              direction: "random",
              animation: {
                enable: true,
                speed: 30,
              },
            },
            tilt: {
              direction: "random",
              enable: true,
              value: {
                min: 0,
                max: 360,
              },
              animation: {
                enable: true,
                speed: 60,
              },
            },
            size: {
              value: 7,
            },
            roll: {
              darken: {
                enable: true,
                value: 25,
              },
              enable: true,
              speed: {
                min: 5,
                max: 15,
              },
            },
            wobble: {
              distance: 30,
              enable: true,
              speed: {
                min: -7,
                max: 7,
              },
            },
            shape: {
              type: ["rectangle", "rectangle", "square", "square"],
              options: {
                image: [
                  {
                    src: Tick,
                    width: 32,
                    height: 32,
                    particles: {
                      size: {
                        value: 16,
                      },
                    },
                  },
                ],
                polygon: [
                  {
                    sides: 5,
                  },
                  {
                    sides: 6,
                  },
                ],
                character: [
                  {
                    fill: true,
                    font: "Verdana",
                    value: ["⛛", "⚪", "⚡", "⚈", "⭐️", "✖"],
                    style: "",
                    weight: 400,
                  },
                ],
              },
            },
          },
        }}
      />
    </StyledDiv>
  )
}

export default Confetti
