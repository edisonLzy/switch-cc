# Neobrutalism UI Refactoring

This document outlines the comprehensive refactoring of Switch CC's UI to use neobrutalism design components.

## Overview

The entire UI has been refactored from a traditional gray-based design to a bold neobrutalism style, featuring:
- High-contrast borders and shadows
- Bold, chunky buttons and cards
- Bright yellow accent colors
- Sharp, defined edges
- Expressive typography

## Key Changes

### 1. Design System Migration

**From**: Traditional Tailwind utility classes with gray palette
**To**: Neobrutalism component library based on shadcn/ui architecture

### 2. Component Library

Added comprehensive neobrutalism UI components in `src/components/ui/`:

- **Button** (`button.tsx`) - Multiple variants with shadow effects
- **Card** (`card.tsx`) - Bold bordered containers with shadows
- **Input/Textarea** (`input.tsx`, `textarea.tsx`) - High-contrast form elements
- **Dialog** (`dialog.tsx`) - Modal system with neobrutalism styling
- **Label** (`label.tsx`) - Typography-focused labels
- **Select** (`select.tsx`) - Dropdown components
- **Checkbox** (`checkbox.tsx`) - Custom checkboxes with shadows
- **Badge** (`badge.tsx`) - Information tags

### 3. Color System

**New Color Palette**:
```css
:root {
  --main: #FFFF00;              /* Bright yellow primary */
  --main-foreground: #000000;    /* Black text on yellow */
  --background: #FFFFFF;          /* White background */
  --foreground: #000000;          /* Black text */
  --border: #000000;              /* Black borders */
  --secondary-background: #EFEFEF; /* Light gray secondary */
}

.dark {
  --main: #FFFF00;              /* Same yellow for consistency */
  --main-foreground: #000000;    /* Black text on yellow */
  --background: #1A1A1A;         /* Dark background */
  --foreground: #FFFFFF;          /* White text */
  --border: #FFFFFF;              /* White borders in dark mode */
  --secondary-background: #2A2A2A; /* Dark gray secondary */
}
```

### 4. Typography System

- **Font Family**: Inter for consistent, modern typography
- **Font Weights**: 
  - `font-base: 500` - Medium weight for body text
  - `font-heading: 700` - Bold weight for headings
- **Improved hierarchy** with better contrast and spacing

### 5. Shadow System

Implemented signature neobrutalism shadow effects:
```css
.shadow-shadow {
  box-shadow: 4px 4px 0px 0px var(--border);
}

.hover\:translate-x-boxShadowX:hover {
  transform: translateX(4px) translateY(4px);
}

.hover\:shadow-none:hover {
  box-shadow: none;
}
```

## Refactored Components

### Main Window Components

1. **MainWindow.tsx**
   - Converted navigation bar to use neobrutalism buttons
   - Updated notification system with bordered styling
   - Applied consistent spacing and typography

2. **ProviderList.tsx**
   - Cards with bold borders and shadows
   - Badge system for categories and status
   - High-contrast button actions

3. **AddProviderModal.tsx**
   - Dialog-based modal system
   - Form elements with neobrutalism styling
   - Preset selection with card-based interface

4. **EditProviderModal.tsx**
   - Consistent dialog structure
   - Form validation with styled error states
   - Code editor with monospace styling

5. **SettingsModal.tsx**
   - Card-based settings sections
   - Custom checkboxes with shadows
   - Information badges

6. **ConfirmDialog.tsx**
   - Alert system with neobrutalism styling
   - Proper button hierarchy

### MenuBar Components

7. **MenuBarWindow.tsx**
   - Compact card-based layout
   - Provider list with shadow effects
   - Status indicators and badges

## Technical Implementation

### Dependencies Added

```json
{
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1", 
  "tailwind-merge": "^3.3.1",
  "@radix-ui/react-slot": "^1.2.3",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-label": "^2.1.7",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-checkbox": "^1.3.3"
}
```

### Configuration Updates

1. **Vite Configuration** (`vite.config.mts`):
   - Added path alias for `@` imports
   - Improved module resolution

2. **Tailwind Configuration** (`tailwind.config.js`):
   - Custom border radius: `base: 5px`
   - Shadow utilities: `shadow: 4px 4px 0px 0px #000`
   - Color system with CSS variables
   - Font weight system

3. **Global Styles** (`globals.css`):
   - CSS variable system for colors
   - Dark mode support
   - Custom scrollbar styling
   - Smooth transitions

### Utility System

Created `src/lib/utils.ts` with `cn()` function for conditional class merging:
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Features Maintained

- ✅ Dark mode support with automatic theme switching
- ✅ Provider management (add/edit/delete/switch)
- ✅ MenuBar and MainWindow modes
- ✅ System tray integration
- ✅ Configuration file management
- ✅ All existing functionality preserved

## Benefits of Refactoring

1. **Visual Appeal**: Bold, modern design that stands out
2. **Consistency**: Unified component library across all interfaces
3. **Accessibility**: High contrast design improves readability
4. **Maintainability**: Centralized component system
5. **Extensibility**: Easy to add new components following the same patterns
6. **Performance**: Optimized component architecture
7. **Developer Experience**: Better TypeScript support with proper typing

## Usage Examples

### Button Variants
```tsx
<Button variant="default">Primary Action</Button>
<Button variant="neutral">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Subtle Action</Button>
```

### Card Layout
```tsx
<Card>
  <CardHeader>
    <CardTitle>Provider Name</CardTitle>
  </CardHeader>
  <CardContent>
    <Badge variant="neutral">Category</Badge>
  </CardContent>
</Card>
```

### Form Elements
```tsx
<div className="space-y-2">
  <Label htmlFor="name">Provider Name</Label>
  <Input id="name" placeholder="Enter name" />
</div>
```

## Build Results

Final build statistics:
- **CSS**: 30.82 kB (6.52 kB gzipped) - includes all neobrutalism styles
- **JavaScript**: 298.25 kB (96.02 kB gzipped) - includes Radix UI components
- **Build time**: ~1.2s - fast and efficient

## Migration Notes

The refactoring maintains complete backward compatibility with:
- Existing Tauri backend integration
- Configuration file formats
- API interfaces
- Dark mode functionality
- All user workflows

No breaking changes were introduced - this is purely a visual enhancement that improves the user experience while maintaining all existing functionality.