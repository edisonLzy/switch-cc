# GEMINI.md

## Project Overview

This project is a cross-platform desktop application named "Switch CC" built with Tauri, React, and Rust. It is designed to manage and quickly switch between different Claude Code configurations. The application provides two main interfaces: a full-featured main window for managing provider configurations and a minimalistic menu bar interface for quick switching.

The frontend is built with React, TypeScript, and Tailwind CSS, while the backend is written in Rust. The application uses `pnpm` as the package manager.

## Building and Running

To build and run the project, you need to have Node.js, pnpm, and Rust installed.

### Development

To run the application in development mode with hot-reloading, use the following command:

```bash
pnpm dev
```

### Building

To build the application for production, use the following command:

```bash
pnpm build
```

This will create a production-ready executable for your platform in the `src-tauri/target/release` directory.

### Testing

The project does not have a dedicated test suite. However, you can use the following commands to check for type errors and formatting issues:

```bash
# Type check
pnpm typecheck

# Format check
pnpm format:check
```

## Development Conventions

### Code Style

The project uses Prettier for code formatting. To format the code, run the following command:

```bash
pnpm format
```

### Commit Style

The project does not have a strict commit message convention. However, it is recommended to write clear and concise commit messages that describe the changes made.

### Branching

The project uses the `main` branch for the latest stable version. Feature branches should be created from the `main` branch and merged back into it after the feature is complete.

### Contribution

The project does not have a formal contribution guide. However, you can contribute by opening issues and pull requests on the project's GitHub repository.
