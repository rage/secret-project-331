# Plugin System Developer Documentation

This documentation provides guidance on adding new exercise types to this Learning Management System (host system) with plugins. Plugins are independent web applications that integrate with the host system by implementing specific user interfaces and REST APIs.

This repo has several examples of plugins.

- services/quizzes - Provides multiple-choice questions, essays, etc.
- services/example-exercise - An example plugin
- services/tmc - Provides programming exercises

External examples:

- https://github.com/rage/language-exercise-service
- https://github.com/rage/factor-analysis-exercise-service

## Creating a new exercise service

The fastest way to start a new plugin is the scaffolding CLI. From a checkout of this repo, run:

```bash
bin/create-exercise-service
```

It generates a standalone Next.js service from `services/example-exercise`, with the shared exercise code vendored into `src/shared-module/`. See `shared-module/packages/create-exercise-service/README.md` for the prompts and what gets generated. The rest of this document explains the protocol the generated service implements.

## Overview

Plugins add new exercise types to the system. Each plugin is an independent web application hosted on a separate server and must implement the following:

1. **Internal Data Types**: Defined by the plugin to represent exercise configurations, answers, and feedback.
2. **User Interfaces**: Accessed through IFrames and communicated with via the [Channel Messaging API](https://developer.mozilla.org/en-US/docs/Web/API/Channel_Messaging_API). These interfaces handle the unique parts of the exercise, while the host system provides common UI elements like exercise names, instructions, points information, and submission buttons.
3. **REST API Endpoints**: Consumed by the host system backend to perform operations like grading and generating exercise specifications.

## Implementation Summary

As a plugin developer, you need to implement:

### User Interfaces (Consumed through IFrames)

- **Exercise Editor View**: For teachers to create and configure exercises.
- **Answer Exercise View**: For students to attempt exercises.
- **View Submission View**: For displaying submitted answers and feedback.
- **Communication Protocol**: Using the Channel Messaging API to communicate between the IFrame and the parent host system page.

### REST API Endpoints (Consumed by the Backend)

- **Service Info Endpoint**: Provides metadata about the plugin and lists other endpoint paths.
- **User Interface IFrame Endpoint**: Serves the HTML content for the plugin's IFrames.
- **Public Spec Generator Endpoint**: Generates a public specification (`public_spec`) from a private specification (`private_spec`).
- **Model Solution Spec Generator Endpoint**: Generates a model solution specification (`model_solution_spec`) from a `private_spec`.
- **Grade Endpoint**: Grades a student's answer.

## User Interfaces (Consumed through IFrames)

### Overview

The plugin's user interfaces are embedded in the host system via IFrames. Communication between the host system and the plugin's IFrame is handled using the Channel Messaging API. The plugin's UI only needs to implement the unique parts of the exercise interface, while common UI elements (exercise name, points, instructions, etc.) are rendered by the host system.

### Establishing Communication Between Parent and IFrame

To facilitate communication between the host system and the plugin's IFrame, a `MessageChannel` is established. Here's how it works:

1. **IFrame Load Event**: The IFrame waits for its content to load completely.
2. **IFrame Readiness Message**: The IFrame sends a `postMessage` to the parent, indicating it is ready to receive the `MessagePort`.
3. **Parent Provides MessagePort**: The parent listens for the readiness message and responds by transferring one end of the `MessageChannel` (`MessagePort`) back to the IFrame.
4. **Communication Established**: Both the parent and IFrame attach event listeners to their respective `MessagePort` objects, enabling bidirectional communication.

### Messages in the Message Channel

Communication between the parent page and the IFrame is restricted to specific messages to ensure security and consistency.

#### Message Summary

| Message                 | From   | To     | Description                                                                                                               |
| ----------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `set-state`             | Parent | IFrame | Sets the view and state of the IFrame. The IFrame discards its own state and switches to the specified view.              |
| `current-state`         | IFrame | Parent | Informs the parent that the IFrame's state has changed. Includes data and validity status.                                |
| `height-changed`        | IFrame | Parent | Notifies the parent that the content height has changed, allowing the parent to resize the IFrame.                        |
| `set-language`          | Parent | IFrame | Informs the IFrame of the user's preferred language using IETF BCP 47 language tags.                                      |
| `open-link`             | Iframe | Parent | The IFrame requests a link to be opened in the browser's main browsing context.                                           |
| `request-iframe-reload` | Iframe | Parent | The IFrame encountered a serious client-side problem (for example, a failed chunk load) and asks the parent to reload it. |

### Views

Plugins must implement the following views, each serving a specific purpose. Remember, these views should only include the unique parts of the exercise interface. Common UI elements are handled by the host system.

#### 1. Exercise Editor View

- **Purpose**: Allows teachers to create and configure exercises.
- **Inputs**: `private_spec` (via `set-state` message).
- **Outputs**: `private_spec` (via `current-state` message).

#### 2. Answer Exercise View

- **Purpose**: Allows students to attempt exercises.
- **Inputs**: `public_spec`, optional `answer` (via `set-state` message).
- **Outputs**: `answer` (via `current-state` message).

#### 3. View Submission View

- **Purpose**: Displays submitted answers along with feedback.
- **Inputs**: `public_spec`, `answer`, optional `grading_feedback`, optional `model_solution_spec` (via `set-state` message).
- **Outputs**: None (read-only).

### Data Types for User Interfaces

Plugins must define the following data types for their internal operations:

1. **`private_spec`**: Full configuration for an exercise, including structure, grading, and model solution.
2. **`public_spec`**: Information needed to render the exercise for students without revealing the correct answers.
3. **`model_solution_spec`**: Information needed to display the model solution to students.
4. **`answer`**: Represents what a student has answered in an exercise.
5. **`grading_feedback`**: Data used to display feedback about the graded answer.

## REST API Endpoints (Consumed by the Backend)

The backend communicates with the plugin via REST to grade answers and generate exercise specifications. Plugins must implement:

1. **Service Info Endpoint**: Provides metadata about the plugin.
2. **User Interface IFrame Endpoint**: Serves the HTML content for the plugin's IFrames.
3. **Public Spec Generator Endpoint**: Generates a `public_spec` from a `private_spec`.
4. **Model Solution Spec Generator Endpoint**: Generates a `model_solution_spec` from a `private_spec`.
5. **Grade Endpoint**: Grades a student's answer.

### Endpoint Details

#### 1. Service Info Endpoint

- **Method**: GET
- **Purpose**: Defines the plugin and lists paths to all other endpoints.

#### 2. User Interface IFrame Endpoint

- **Purpose**: Serves the HTML content for the plugin's IFrames.

#### 3. Public Spec Generator Endpoint

- **Method**: POST
- **Purpose**: Generates a `public_spec` from a `private_spec`.

#### 4. Model Solution Spec Generator Endpoint

- **Method**: POST
- **Purpose**: Generates a `model_solution_spec` from a `private_spec`.

#### 5. Grade Endpoint

- **Method**: POST
- **Purpose**: Grades a student's answer.

## Input and Output Types Summary

### Views

| View Type           | Inputs                                                                               | Outputs        |
| ------------------- | ------------------------------------------------------------------------------------ | -------------- |
| **Exercise Editor** | `private_spec`                                                                       | `private_spec` |
| **Answer Exercise** | `public_spec`, optional `answer`                                                     | `answer`       |
| **View Submission** | `public_spec`, `answer`, optional `grading_feedback`, optional `model_solution_spec` | None           |

### REST API Endpoints

| Endpoint Name                     | Inputs                   | Outputs               |
| --------------------------------- | ------------------------ | --------------------- |
| **Service Info**                  | None                     | Metadata              |
| **Public Spec Generator**         | `private_spec`           | `public_spec`         |
| **Model Solution Spec Generator** | `private_spec`           | `model_solution_spec` |
| **Grade Endpoint**                | `private_spec`, `answer` | `grading_feedback`    |

## Example Scenarios

### Scenario 1: Editing and Saving an Exercise

1. Teacher opens the CMS to edit a page containing an exercise.
2. CMS loads the plugin IFrame and establishes communication.
3. CMS sends `set-state` with the current `private_spec` to the IFrame.
4. Teacher edits the exercise. Plugin sends `current-state` with the updated `private_spec`.
5. On save, CMS sends the latest `private_spec` to the backend.
6. Backend calls the Public Spec Generator and Model Solution Spec Generator endpoints.
7. Backend stores `private_spec`, `public_spec`, and `model_solution_spec`.

### Scenario 2: Answering and Grading an Exercise

1. Student opens course material containing the exercise.
2. Course material loads the plugin IFrame and establishes communication.
3. Course material sends `set-state` with the `public_spec` to the IFrame.
4. Student interacts with the exercise. Plugin sends `current-state` with the updated `answer`.
5. Student submits. Course material sends the `answer` to the backend.
6. Backend retrieves `private_spec` and calls the Grade endpoint with `private_spec` and `answer`.
7. Plugin returns `correctness_coefficient` and `grading_feedback`. Backend stores this.
8. Course material sends `set-state` to switch the IFrame to the View Submission view with `public_spec`, `answer`, `grading_feedback`, and optionally `model_solution_spec`.

## Developer Tool: Playground

The [Playground](https://courses.mooc.fi/playground-tabs) simulates the host environment. Use it to preview your plugin's views, test the communication protocol, and inspect data types.
