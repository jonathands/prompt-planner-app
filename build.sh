#!/bin/bash

# Prompt Manager - Cross-Platform Build Script
# Usage: ./build.sh [platform]
# Platform options: linux, windows, mac, all

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Clean dist directory
clean_dist() {
    print_info "Cleaning dist directory..."
    rm -rf dist/
    print_success "Cleaned dist directory"
}

# Build for Linux
build_linux() {
    print_info "Building for Linux..."
    npm run build:linux
    print_success "Linux build completed"
    print_info "Outputs:"
    ls -lh dist/*.AppImage dist/*.deb 2>/dev/null || true
}

# Build for Windows
build_windows() {
    print_info "Building for Windows..."
    npm run build:win
    print_success "Windows build completed"
    print_info "Outputs:"
    ls -lh dist/*.exe 2>/dev/null || true
}

# Build for macOS
build_mac() {
    print_info "Building for macOS..."
    npm run build:mac
    print_success "macOS build completed"
    print_info "Outputs:"
    ls -lh dist/*.dmg dist/*.zip 2>/dev/null || true
}

# Build for all platforms
build_all() {
    print_info "Building for all platforms..."
    npm run build:all
    print_success "All platforms built"
    print_info "All outputs:"
    ls -lh dist/ 2>/dev/null || true
}

# Main script
main() {
    local platform="${1:-linux}"

    echo "=================================================="
    echo "  Prompt Manager - Build Script"
    echo "=================================================="
    echo ""

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_error "node_modules not found. Running npm install..."
        npm install
    fi

    case "$platform" in
        linux|l)
            clean_dist
            build_linux
            ;;
        windows|win|w)
            clean_dist
            build_windows
            ;;
        mac|macos|m)
            clean_dist
            build_mac
            ;;
        all|a)
            clean_dist
            build_all
            ;;
        *)
            print_error "Unknown platform: $platform"
            echo ""
            echo "Usage: $0 [platform]"
            echo "Platforms:"
            echo "  linux, l       - Build for Linux (AppImage, deb)"
            echo "  windows, w     - Build for Windows (NSIS, portable)"
            echo "  mac, m         - Build for macOS (DMG, zip)"
            echo "  all, a         - Build for all platforms"
            exit 1
            ;;
    esac

    echo ""
    print_success "Build process completed!"
    echo "Output directory: dist/"
}

main "$@"
