import { injectGlobal } from "@emotion/css"

export const tokensGlobal = injectGlobal`
  :root {
    /* sizing */
    --control-gap: var(--space-3);
    --control-radius: var(--space-3);

    --control-height-sm: var(--space-5);
    --control-height-md: var(--space-6);
    --control-height-lg: var(--space-7);

    --control-padding-x-sm: var(--space-3);
    --control-padding-x-md: var(--space-4);
    --control-padding-x-lg: var(--space-5);

    --font-size-sm: var(--font-size-2);
    --font-size-md: var(--font-size-2);
    --font-size-lg: var(--font-size-3);

    /* spacing scale */
    --space-0: 0px;
    --space-1: 2px;
    --space-2: 4px;
    --space-3: 8px;
    --space-4: 16px;
    --space-5: 32px;
    --space-6: 40px;
    --space-7: 48px;

    /* type scale */
    --font-size-1: 14px;
    --font-size-2: 16px;
    --font-size-3: 18px;
    --font-size-4: 24px;
    --font-size-5: 32px;

    /* focus ring */
    --focus-ring-width: 2px;
    --focus-ring-offset: 2px;
    --focus-ring-offset-color: transparent;
    --focus-ring-color: rgba(0, 120, 212, 0.6);

    /* disabled */
    --btn-disabled-opacity: 0.55;

    /* loading */
    --btn-loading-opacity: 0.8;

    /* pressed */
    --btn-pressed-offset: 2px;
    --btn-pressed-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);

    /* transitions */
    --btn-transition: all 0.2s;
    --btn-press-transition: all 0.1s cubic-bezier(0.34, 1.56, 0.64, 1);

    /* palette */
    --color-blue-25: #fbfcfd;
    --color-blue-50: #f2f5f7;
    --color-blue-75: #edf1f5;
    --color-blue-100: #dae3eb;
    --color-blue-200: #b5c7d7;
    --color-blue-300: #90abc3;
    --color-blue-400: #6b8faf;
    --color-blue-500: #46749b;
    --color-blue-600: #215887;
    --color-blue-700: #08457a;
    --color-blue-800: #0e3657;
    --color-blue-900: #0f263b;
    --color-blue-1000: #0a1722;

    --color-green-25: #fbfcfc;
    --color-green-50: #f2f5f5;
    --color-green-75: #edf3f2;
    --color-green-100: #dae6e5;
    --color-green-200: #b4cdcb;
    --color-green-300: #8fb4b2;
    --color-green-400: #6a9b98;
    --color-green-500: #44827e;
    --color-green-600: #1f6964;
    --color-green-700: #065853;
    --color-green-800: #154541;
    --color-green-900: #163331;
    --color-green-1000: #122221;

    --color-crimson-25: #fdfbfb;
    --color-crimson-50: #f7f3f4;
    --color-crimson-75: #f4edee;
    --color-crimson-100: #eadbdd;
    --color-crimson-200: #d5b7ba;
    --color-crimson-300: #c09397;
    --color-crimson-400: #ac6e75;
    --color-crimson-500: #974a53;
    --color-crimson-600: #822630;
    --color-crimson-700: #740e19;
    --color-crimson-800: #57141c;
    --color-crimson-900: #3d1316;
    --color-crimson-1000: #260e0f;

    --color-red-25: #fdfbfb;
    --color-red-50: #f9f4f3;
    --color-red-75: #f7f0ef;
    --color-red-100: #f0e1dd;
    --color-red-200: #e2c2bc;
    --color-red-300: #d3a49a;
    --color-red-400: #c58579;
    --color-red-500: #b66757;
    --color-red-600: #a84835;
    --color-red-700: #9e341f;
    --color-red-800: #823425;
    --color-red-900: #693126;
    --color-red-1000: #512c24;

    --color-yellow-25: #fdfcf6;
    --color-yellow-50: #ffffff;
    --color-yellow-75: #fdfcf6;
    --color-yellow-100: #faf6e3;
    --color-yellow-200: #f6edc6;
    --color-yellow-300: #f1e4a9;
    --color-yellow-400: #ecdb8d;
    --color-yellow-500: #e8d270;
    --color-yellow-600: #e3c954;
    --color-yellow-700: #e0c341;
    --color-yellow-800: #d5bf5b;
    --color-yellow-900: #cbba6e;
    --color-yellow-1000: #c2b57c;

    --color-purple-25: #fcfbfd;
    --color-purple-50: #f5f3f9;
    --color-purple-75: #f2f0f8;
    --color-purple-100: #e5e0f1;
    --color-purple-200: #cbc1e2;
    --color-purple-300: #b1a2d4;
    --color-purple-400: #9783c5;
    --color-purple-500: #7c64b7;
    --color-purple-600: #6245a9;
    --color-purple-700: #51309f;
    --color-purple-800: #422b77;
    --color-purple-900: #312455;
    --color-purple-1000: #221b38;

    --color-gray-25: #fcfcfc;
    --color-gray-50: #f4f4f5;
    --color-gray-75: #eeeff0;
    --color-gray-100: #dddfe0;
    --color-gray-200: #babdc2;
    --color-gray-300: #989ca3;
    --color-gray-400: #767b85;
    --color-gray-500: #535a66;
    --color-gray-600: #313947;
    --color-gray-700: #1a2333;
    --color-gray-800: #0a0f17;
    --color-gray-900: #010203;
    --color-gray-1000: #000000;

    --color-clear-25: #fbfcfc;
    --color-clear-50: #ffffff;
    --color-clear-75: #fbfcfc;
    --color-clear-100: #f5f6f7;
    --color-clear-200: #ebedee;
    --color-clear-300: #e2e4e6;
    --color-clear-400: #d8dbdd;
    --color-clear-500: #ced2d5;
    --color-clear-600: #c4c9cd;
    --color-clear-700: #bec3c7;
    --color-clear-800: #b8bdc1;
    --color-clear-900: #b3b7ba;
    --color-clear-1000: #adb1b4;

    --color-primary-100: #ffffff;
    --color-primary-200: #000000;

    --gradient-green: linear-gradient(to bottom right, #075854, #4de2c5);
    --gradient-blue: linear-gradient(-70deg, #020344 0%, #28b8d5 100%);

    /* primary */
    --btn-primary-bg: var(--color-green-600);
    --btn-primary-fg: var(--color-primary-100);
    --btn-primary-border: var(--color-green-600);
    --btn-primary-bg-hover: var(--color-primary-100);
    --btn-primary-fg-hover: var(--color-green-700);
    --btn-primary-border-hover: var(--color-primary-100);
    --btn-primary-bg-pressed: var(--color-green-800);
    --btn-primary-shadow-hover: 0 4px 12px rgba(31, 105, 100, 0.15);
    --btn-primary-outline-width: 3px;

    /* secondary */
    --btn-secondary-bg: var(--color-clear-200);
    --btn-secondary-fg: var(--color-gray-700);
    --btn-secondary-border: var(--color-clear-200);
    --btn-secondary-bg-hover: var(--color-gray-700);
    --btn-secondary-fg-hover: var(--color-clear-50);
    --btn-secondary-border-hover: var(--color-gray-700);
    --btn-secondary-bg-pressed: var(--color-clear-400);
    --btn-secondary-shadow-hover: 0 4px 12px rgba(26, 35, 51, 0.15);
    --btn-secondary-outline-width: 3px;

    /* tertiary */
    --btn-tertiary-bg: transparent;
    --btn-tertiary-fg: var(--color-gray-700);
    --btn-tertiary-border: var(--color-clear-400);
    --btn-tertiary-bg-hover: var(--color-gray-700);
    --btn-tertiary-fg-hover: var(--color-primary-100);
    --btn-tertiary-border-hover: var(--color-gray-700);
    --btn-tertiary-bg-pressed: var(--color-clear-300);
    --btn-tertiary-shadow-hover: 0 4px 12px rgba(26, 35, 51, 0.15);
    --btn-tertiary-outline-width: 3px;
  }
`
