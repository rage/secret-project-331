# Secret Project 331 - Documentation for Developers

> [!IMPORTANT]
> This document contains technical information intended for software developers. If you're not a software developer, you might find these resources helpful instead:
>
> - To learn more about the courses, visit [https://www.mooc.fi](https://www.mooc.fi).
> - For teacher documentation, refer to the **Wiki** tab in this repository.

## Introduction

**Secret Project 331** is a Learning Management System (LMS) developed by the MOOC Center of the University of Helsinki. It's deployed at [https://courses.mooc.fi](https://courses.mooc.fi).

## Getting Started

- Set up your computer for development: [Development Environment Setup](./Development.md)
- Set up VDI for MOOC Center staff: [VDI Setup](./vdi-setup.md)

## How the System Works

- Overview of the system: [Project Architecture](./architecture.md)

## Development Guides

- Working with the backend and shared code: [Frontend Development](./frontend.md)
- Database setup and updates: [Backend Development](./headless-lms.md)
- Adding new exercises: [Plugin System](./plugin-system.md)
- Making the site work on all devices: [Mobile-First CSS](./mobile-first-css.md)
- Adding different languages: [Internationalization](./internationalization.md)
- Creating new blocks for content: [Blocks Development](./blocks.md)

## Deployment

- How to put the system online: [Deployment Workflow](./deployment.md)
- Testing and updating Docker files: [Dockerfile Updates](./updating-dockerfiles.md)

## Database Tasks

- Using DataGrip for database work: [DataGrip Guide](./datagrip-operations.md)

## Testing

- How to write and run tests: [Testing Guide](./tests.md)

## Design Requirements

- Frontend should work with a screen width of at least 320 pixels.

## Updating Dependencies

- How to update dependencies: [Update Guide](./updating-dependencies.md)

## Extra Resources

- Language data: [Localizations](../shared-module/packages/common/src/locales/en/main-frontend.json)
- Command-line tools: [Commands](../bin)
- Design files: [Figma](https://www.figma.com/design/7SCSdeHG5FnLNZLfd6SnBI/Teacher-redesign)
- Route helper functions: [Routes](../shared-module/packages/common/src/utils/routes.ts)
- See also the recommended resources on the README of the repo: [GitHub Repository](https://github.com/rage/secret-project-331)

## Help and Contributions

- **Project Code**: [GitHub Repository](https://github.com/rage/secret-project-331)
