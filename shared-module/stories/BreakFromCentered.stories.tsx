/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { Meta, Story } from "@storybook/react"
import React from "react"

import BreakFromCentered from "../src/components/Centering/BreakFromCentered"
import Centered from "../src/components/Centering/Centered"

export default {
  title: "Components/Centering/BreakFromCentered",
  component: BreakFromCentered,
} as Meta

const Component = BreakFromCentered

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

const DefaultTemplate: Story<ComponentProps> = (args: ComponentProps) => (
  <Wrapper>
    <Centered variant="narrow">
      {children}
      <Component {...args} />
      {children}
    </Centered>
  </Wrapper>
)

export const Default: Story<ComponentProps> = DefaultTemplate.bind({})
Default.args = {
  children: (
    <div
      className={css`
        background-color: #fffff0;
        padding: 1rem 0.5rem;
        border: 1px solid #333;
      `}
    >
      This content should have broken free from the centering.
    </div>
  ),
}

const WithSidebarOnLeftTemplate: Story<ComponentProps> = (args: ComponentProps) => (
  <Wrapper>
    <div
      className={css`
        width: 20rem;
        position: absolute;
        left: 0;
        top: 0;
        padding-top: 40px;
        background-color: #e2f5fb;
        height: 100%;
        font-weight: bold;
        font-size: 60px;
        color: #333;
      `}
    >
      <div
        className={css`
          transform: rotate(-90deg);
          position: relative;
          bottom: -80px;
        `}
      >
        Sidebar
      </div>
    </div>
    <div
      className={css`
        margin-left: 20rem;
      `}
    >
      <Centered variant="narrow">
        {children}
        <Component {...args} />
        {children}
      </Centered>
    </div>
  </Wrapper>
)

export const WithSidebarOnLeft: Story<ComponentProps> = WithSidebarOnLeftTemplate.bind({})
WithSidebarOnLeft.args = {
  sidebar: true,
  sidebarPosition: "left",
  sidebarWidth: "20rem",
  children: (
    <div
      className={css`
        background-color: #fffff0;
        padding: 1rem 0.5rem;
        border: 1px solid #333;
      `}
    >
      This content should have broken free from the centering.
    </div>
  ),
}

const WithSidebarOnRightTemplate: Story<ComponentProps> = (args: ComponentProps) => (
  <Wrapper>
    <div
      className={css`
        width: 20rem;
        height: 100vh;
        position: absolute;
        right: 0;
        top: 0;
        padding-top: 40px;
        background-color: #e2f5fb;
        font-weight: bold;
        font-size: 60px;
        color: #333;
      `}
    >
      <div
        className={css`
          transform: rotate(-90deg);
          position: relative;
          bottom: -80px;
        `}
      >
        Sidebar
      </div>
    </div>
    <div
      className={css`
        margin-right: 20rem;
      `}
    >
      <Centered variant="narrow">
        {children}
        <Component {...args} />
        {children}
      </Centered>
    </div>
  </Wrapper>
)

export const WithSidebarOnRight: Story<ComponentProps> = WithSidebarOnRightTemplate.bind({})
WithSidebarOnRight.args = {
  sidebar: true,
  sidebarPosition: "right",
  sidebarWidth: "20rem",
  children: (
    <div
      className={css`
        background-color: #fffff0;
        padding: 1rem 0.5rem;
        border: 1px solid #333;
      `}
    >
      This content should have broken free from the centering.
    </div>
  ),
}
