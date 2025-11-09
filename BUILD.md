# Building Prompt Manager

This document explains how to build Prompt Manager for different platforms.

## Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

## Quick Start

### Using the Build Script

The easiest way to build the application is using the provided `build.sh` script:

```bash
# Build for Linux (default)
./build.sh linux

# Build for Windows
./build.sh windows

# Build for macOS
./build.sh mac

# Build for all platforms
./build.sh all
```

### Using npm Scripts

You can also use npm scripts directly:

```bash
# Build for Linux
npm run build:linux

# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for all platforms
npm run build:all
```

## Platform-Specific Builds

### Linux

Builds two formats:
- **AppImage** (universal, runs on any distro)
- **DEB package** (for Debian/Ubuntu-based systems)

```bash
npm run build:linux
```

Output files:
- `dist/Prompt Manager-1.0.0.AppImage`
- `dist/prompt-manager-electron_1.0.0_amd64.deb`

### Windows

Builds two formats:
- **NSIS installer** (standard Windows installer)
- **Portable executable** (no installation required)

```bash
npm run build:win
```

Output files:
- `dist/Prompt Manager Setup 1.0.0.exe`
- `dist/Prompt Manager 1.0.0.exe` (portable)

### macOS

Builds two formats:
- **DMG** (disk image for installation)
- **ZIP** (compressed archive)

```bash
npm run build:mac
```

Output files:
- `dist/Prompt Manager-1.0.0.dmg`
- `dist/Prompt Manager-1.0.0-mac.zip`

## Individual Format Builds

Build specific formats only:

```bash
# Linux
npm run build:appimage  # AppImage only
npm run build:deb       # DEB only
npm run build:snap      # Snap package
```

## Output Directory

All builds are output to the `dist/` directory, which is excluded from git via `.gitignore`.

## Troubleshooting

### Build fails with "node_modules not found"

Run `npm install` first:
```bash
npm install
```

### Missing dependencies

Install electron-builder:
```bash
npm install --save-dev electron-builder
```

### Clean build

Remove the dist directory and rebuild:
```bash
rm -rf dist/
npm run build:linux
```

## Build Configuration

Build settings are configured in `package.json` under the `build` section. You can customize:

- Application ID
- Product name
- Target formats
- Icons
- Output directory
- And more...

See [electron-builder documentation](https://www.electron.build/) for all available options.
