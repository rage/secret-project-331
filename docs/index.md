# Secret Project 331 Documentation Index

## 📌 Introduction

**Secret Project 331** is a Learning Management System (LMS) developed by the MOOC Center of the University of Helsinki. It's deployed at [https://courses.mooc.fi](https://courses.mooc.fi). This documentation is intended for developers and provides technical insights, setup instructions, and detailed guides to facilitate development and contribution.

For non-developers:

- **Learn more about the courses**: [https://www.mooc.fi](https://www.mooc.fi)
- **Teacher Documentation**: Refer to the **Wiki** tab in this repository.

## 🚀 Getting Started

- Set up local environment: [Development Environment Setup](./Development.md)
- Configure VDI: [VDI Setup for MOOC Center Employees](./vdi-setup.md)

## 🏛 Architecture

- System architecture overview: [Project Architecture](./architecture.md)

## 💻 Development Guides

- Interact with backend, shared modules: [Frontend Development](./frontend.md)
- Database interactions, migrations: [Backend Development](./headless-lms.md)
- Extend LMS with new exercises: [Plugin System](./plugin-system.md)
- Implement responsive designs: [Mobile-First CSS](./mobile-first-css.md)
- Support multiple languages: [Internationalization](./internationalization.md)
- Develop new blocks for CMS and course material: [Blocks Development](./blocks.md)

## 📦 Deployment

- Deployment process and CI/CD: [Deployment Workflow](./deployment.md)
- Test/manage Dockerfile changes: [Testing Changes to Dockerfiles](./updating-dockerfiles.md)

## 🗄 Database Operations

- Perform database operations: [DataGrip Operations](./datagrip-operations.md)

## 🗂 Version Control

- Enhance Git workflow: [GIT Notes](./git.md)

## 🧪 Testing

- Write and execute tests: [Testing](./tests.md)

## 📋 Requirements

- Frontend should be designed with a minimum viable width of 320 pixels.

## 🔄 Updating Dependencies

- [Updating Dependencies Guide](./updating-dependencies.md)

## 📚 Additional Documentation and links

- Additional notes: [Miscellaneous Notes](./etc.md)
- Localization data: [Localizations](../shared-module/packages/common/src/locales/en/main-frontend.json)
- Bin-commands: [Commands](../bin)
- Figma design: [Figma](https://www.figma.com/design/7SCSdeHG5FnLNZLfd6SnBI/Teacher-redesign)
- Routes helper functions: [Routes](../shared-module/packages/common/src/utils/routes.ts)

## 📞 Support and Contributions

- **Project Repository**: [GitHub Repository](https://github.com/rage/secret-project-331)
