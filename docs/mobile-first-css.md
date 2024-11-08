# Mobile-First CSS

In a **mobile-first CSS** approach, styles are written first for mobile devices, using the smallest screen sizes as the starting point. As the screen size increases, desktop-specific styles are progressively added through media queries. This approach helps ensure that the core design works well on mobile devices, even if the initial design wasn't specifically created for mobile.

> **Note**: Mobile-first CSS and mobile-first design are related but distinct concepts. **Mobile-first CSS** is a coding approach where styling begins with mobile devices, whereas **mobile-first design** refers to the overall design process starting with mobile layouts and user experience considerations. Although we use mobile-first CSS in this project, our designs may not always be mobile-first, depending on the part of the application.

## Concept

For an in-depth explanation of mobile-first CSS, see [this article](https://zellwk.com/blog/how-to-write-mobile-first-css/).

## How to Use Mobile-First CSS in this Project

To apply mobile-first CSS in this project, use the `respondToOrLarger` helper function. This function allows you to easily add media queries within your styles, setting mobile styles by default and adding adjustments for larger screens.

You can find `respondToOrLarger` in `shared-module/packages/common/src/styles/respond.ts`.

### Implementation Steps

1. **Define Base Mobile Styles**: Start by defining your component styles as they should appear on mobile devices.
2. **Use Media Queries for Larger Screens**: Use `respondToOrLarger` to apply styles for larger screens as needed.

### Example Usage

Below is an example of using `respondToOrLarger`. This sets up a responsive layout where elements stack vertically on mobile and align horizontally on larger screens.

```js
<div
  className={css`
    display: flex;
    flex: 2;

    /* Default mobile styles: stack child components vertically */
    flex-direction: column;
    justify-content: space-between;

    /* Styles for screens larger than .sm */
    ${respondToOrLarger.sm} {
      /* Align child components horizontally on larger screens */
      flex-direction: row;
    }
  `}
></div>
```
