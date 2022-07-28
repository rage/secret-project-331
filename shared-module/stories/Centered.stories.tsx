/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { Meta, Story } from "@storybook/react"
import React from "react"

import Centered from "../src/components/Centering/Centered"

export default {
  title: "Components/Centering/Centered",
  component: Centered,
} as Meta

const Component = Centered

type ComponentProps = React.ComponentProps<typeof Component>

const children = (
  <>
    <p>
      McLaughlin: The centering method that is also being developed at the UCI has been developed on
      the UCI&apos;s technical facilities.
    </p>

    <p>
      Garnold: Yes. The center of gravity in the track will be much larger and I think it must be a
      much more difficult target for you to operate if you have to get around a corner and you have
      to drive down the lane.
    </p>

    <p>
      McLaughlin: That&apos;s true, but it depends on your location in the track. The track with the
      highest gradient on the line is the one with the longest track of any of the UCI track and
      this means the center of gravity of the track needs to be above 100 in order to be able to
      maintain a high gradient.
    </p>

    <p>
      Garnold: Yes. It would be very easy to say that to operate if you have your hand in the wheel
      on a track like the UCI or as an individual in the UCI. That is true for certain types of
      riders at the track. But more importantly it would be true when you are performing this
      maneuver on the Pirelli road course.
    </p>
  </>
)

const Wrapper: React.FC<React.PropsWithChildren<React.PropsWithChildren<unknown>>> = ({
  children,
}) => (
  <div
    className={css`
      p {
        margin-bottom: 0.5rem;
      }
    `}
  >
    {children}
  </div>
)

const Template: Story<ComponentProps> = (args: ComponentProps) => (
  <Wrapper>
    <Component {...args} />
  </Wrapper>
)

export const Default: Story<ComponentProps> = Template.bind({})
Default.args = {
  variant: "default",
  children: children,
}

export const Narrow: Story<ComponentProps> = Template.bind({})
Narrow.args = {
  variant: "narrow",
  children: children,
}
