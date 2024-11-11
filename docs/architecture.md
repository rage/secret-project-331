# Project Architecture

![Architecture Diagram](./img/architecture.svg)

## Services

The system consists of microservices, organized here by function.

### Frontends

- **Main Frontend** (`services/main-frontend`): Core user interface.
- **Course Material** (`services/course-material`): Provides course content.
- **CMS** (`services/cms`): Course content editor, uses Gutenberg.

### Backend

- **Headless LMS** (`services/headless-lms`): Manages business logic, data storage, and external service integration.

### Exercise Plugins

See [Plugin System](./plugin-system.md) for more details.

- **TMC** (`services/tmc`): Automated assessment of coding exercises.
- **Quizzes** (`services/quizzes`): Quiz creation and grading.
- **Example Exercise** (`services/example-exercise`): Plugin template for new exercise types.

Not all plugins are in this monorepo; additional plugins can be developed externally and integrated at runtime.

## Other Components

- **Shared Module** (`shared-module`): Common utilities and components used across services.
- **System Tests** (`system-tests`): End-to-end tests ensuring system functionality and integration.
