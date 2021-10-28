/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import { Meta, Story } from "@storybook/react"
import React from "react"

import SpeechBalloon from "../src/components/SpeechBalloon"

export default {
  title: "Components/SpeechBalloon",
  component: SpeechBalloon,
} as Meta

const Component = SpeechBalloon

type ComponentProps = React.ComponentProps<typeof Component>

const Template: Story<ComponentProps> = (args: ComponentProps) => <Component {...args} />

export const Primary: Story<ComponentProps> = Template.bind({})
Primary.args = {
  children: "SpeechBalloon",
}

export const Positioned: Story<ComponentProps> = Template.bind({})
Positioned.args = {
  children: "A positioned SpeechBalloon",
  className: css`
    position: absolute;
    right: 0;
    top: 0;
  `,
}
