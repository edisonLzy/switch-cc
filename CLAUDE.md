# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Development
pnpm dev                    # Start full Tauri development environment
pnpm dev:renderer          # Start only frontend development server

# Build
pnpm build                 # Build production version
pnpm build:renderer        # Build only frontend

# Code Quality
pnpm typecheck             # TypeScript type checking
pnpm format                # Format code with Prettier
pnpm format:check          # Check code formatting

# Rust Backend (in src-tauri/)
cargo fmt                  # Format Rust code
cargo clippy               # Rust linter
cargo test                 # Run Rust tests
```

## Architecture Overview

Switch CC is a dual-mode desktop application built with Tauri 2.8 + React 18, designed for managing both Claude Code and Codex configurations.

### Core Architecture

- **Frontend**: React 18 + TypeScript + Tailwind CSS 4
- **Backend**: Rust + Tauri 2.8 with system tray integration
- **Build System**: Vite + pnpm
- **Configuration Targets**: 
  - `~/.claude/settings.json` (Claude Code config)
  - `~/.codex/config.json` (Codex config)

### Dual Interface Pattern

The application operates in two distinct modes:

1. **Main Window Mode** (`MainWindow`): Full-featured provider management interface
2. **MenuBar Mode** (`MenuBarWindow`): Compact quick-switch interface for system tray

Mode switching is handled by the `AppMode` enum in Rust and controlled via Tauri commands.

### Key Components

#### Frontend Structure
- `src/components/MainWindow/`: Complete provider management UI
- `src/components/MenuBar/`: Compact switching interface
- `src/config/presets.ts`: Predefined provider templates (Claude: Zhipu AI, AnyRouter, PackyCode; Codex: OpenAI, Azure OpenAI)
- `src/lib/tauri-api.ts`: Centralized Tauri command wrapper
- `src/types.ts`: Core TypeScript interfaces

#### Backend Structure
- `src-tauri/src/commands.rs`: All Tauri commands for provider management
- `src-tauri/src/provider.rs`: Provider data structures and validation
- `src-tauri/src/config.rs`: Configuration file management with atomic writes
- `src-tauri/src/menubar.rs`: MenuBar window lifecycle management
- `src-tauri/src/store.rs`: Application state management with AppState struct
- `src-tauri/src/lib.rs`: Main entry point with tray menu creation and event handling

### Configuration Management

- **App Config**: Platform-specific config directory + `/switch-cc/config.json` - stores providers and current selection
  - **macOS**: `~/Library/Application Support/switch-cc/config.json`
  - **Windows**: `%APPDATA%\switch-cc\config.json`
  - **Linux**: `~/.config/switch-cc/config.json`
- **Target Configs**: 
  - Claude: `~/.claude/settings.json` - Claude Code configuration
  - Codex: `~/.codex/config.json` - Codex configuration
- **Atomic Writes**: All config operations use atomic write patterns to prevent corruption

### System Integration Features

- **System Tray**: Dynamic menu generation based on available providers
- **Single Instance**: Prevents multiple app instances
- **Window State Management**: Proper minimize/restore behavior
- **Cross-platform**: Windows, macOS, Linux support with platform-specific optimizations

### Provider System

Providers are defined with the interface:
```typescript
interface Provider {
  id: string;
  name: string;
  settingsConfig: Record<string, any>; // Maps to Claude/Codex config files
  websiteUrl?: string;
  providerType?: ProviderType; // "claude" | "codex"
  category?: ProviderCategory;
  createdAt?: number;
}
```

Provider types:
- **Claude**: Uses `env.ANTHROPIC_AUTH_TOKEN` and `env.ANTHROPIC_BASE_URL`
- **Codex**: Uses `openai.api_key`, `openai.organization_id`, `openai.api_base`

Categories include: `official`, `cn_official`, `aggregator`, `third_party`, `custom`.

### Event System

- Tauri events for frontend-backend communication
- System tray events for quick provider switching
- Window lifecycle events for mode transitions

## Development Guidelines

### Adding New Providers
Add presets in `src/config/presets.ts` with proper categorization and Claude-compatible settings format.

### Modifying Tauri Commands
1. Define command in `src-tauri/src/commands.rs`
2. Register in `src-tauri/src/lib.rs` invoke_handler
3. Add wrapper method in `src/lib/tauri-api.ts`

### Window Management
Use existing window labels: `main` for MainWindow, `menubar` for MenuBar. Window configurations are defined in `src-tauri/tauri.conf.json`.

### State Management
Access `AppState` via Tauri's state management system. Use proper mutex locking when accessing shared state.