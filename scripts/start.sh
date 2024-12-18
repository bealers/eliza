#!/bin/bash

REQUIRED_NODE_VERSION=23

usage() {
    echo "===== DEV HELPER: NOT FOR PRODUCTION USE ====="
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --quick               Skip cleaning and building steps"
    echo "  --characters=<path>   Path to character configuration file"
    echo "  --client=<type>      Client type (web or cli, default: web)"
    echo
    echo "Examples:"
    echo "  $0                                    # Full build and start with web client"
    echo "  $0 --quick                           # Quick start with web client"
    echo "  $0 --client=cli                      # Start with CLI only, no web interface"
    echo "  $0 --characters=characters/default.json  # Start with custom character"
}

cleanup() {
    echo "Cleaning up processes..."
    # Kill any processes on our ports
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    lsof -ti:5173 | xargs kill -9 2>/dev/null

    # Kill our stored PIDs if they exist
    if [ ! -z "$SERVER_PID" ]; then
        kill -9 $SERVER_PID 2>/dev/null
    fi
    if [ ! -z "$CLIENT_PID" ]; then
        kill -9 $CLIENT_PID 2>/dev/null
    fi
}

QUICK_START=false
CHARACTER_PATH=""
CLIENT_TYPE="web"

# Show usage if -h or --help is passed
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    usage
    exit 0
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --characters=*)
            CHARACTER_PATH="${1#*=}"
            shift
            ;;
        --quick)
            QUICK_START=true
            shift
            ;;
        --client=*)
            CLIENT_TYPE="${1#*=}"
            shift
            ;;
        *)
            echo "Unknown parameter: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate client type
if [[ "$CLIENT_TYPE" != "web" ]] && [[ "$CLIENT_TYPE" != "cli" ]]; then
    echo "Error: Invalid client type. Must be 'web' or 'cli'"
    usage
    exit 1
fi

CURRENT_NODE_VERSION=$(node -v | sed 's/v//' | cut -d'.' -f1)

# Simple numeric comparison using bc
if (( CURRENT_NODE_VERSION < REQUIRED_NODE_VERSION )); then
    echo "Error: Node.js version must be $REQUIRED_NODE_VERSION or higher. Current version is $CURRENT_NODE_VERSION"
    exit 1
fi

cd "$(dirname "$0")"/..

# Set up cleanup on script exit
trap cleanup EXIT

# Add debug info
echo "Checking ports before start..."
lsof -i :3000 || echo "Port 3000 is free"
if [[ "$CLIENT_TYPE" == "web" ]]; then
    lsof -i :5173 || echo "Port 5173 is free"
fi

if [ "$QUICK_START" = false ]; then
    echo -e "\033[1mCleaning cache...\033[0m"
    if ! pnpm clean; then
        echo -e "\033[1;31mFailed to clean cache\033[0m"
        exit 1
    fi

    echo -e "\033[1mInstalling dependencies...\033[0m"
    if ! pnpm i; then
        echo -e "\033[1;31mFailed to install dependencies\033[0m"
        exit 1
    fi

    echo -e "\033[1mBuilding project...\033[0m"
    if ! pnpm build; then
        echo -e "\033[1;31mFailed to build project\033[0m"
        exit 1
    fi
fi

# Start backend (api running on port 3000)
echo -e "\033[1mStarting project...\033[0m"
if [ -n "$CHARACTER_PATH" ]; then
    if [[ "$CLIENT_TYPE" == "cli" ]]; then
        # Run in foreground for CLI mode
        pnpm start --characters="$CHARACTER_PATH"
    else
        # Background for web mode
        pnpm start --characters="$CHARACTER_PATH" &
        SERVER_PID=$!
    fi
else
    if [[ "$CLIENT_TYPE" == "cli" ]]; then
        # Run in foreground for CLI mode
        pnpm start
    else
        # Background for web mode
        pnpm start &
        SERVER_PID=$!
    fi
fi

# Only start web client if requested
if [[ "$CLIENT_TYPE" == "web" ]]; then
    # Start client
    echo -e "\033[1mStarting web client...\033[0m"
    pnpm start:client &
    CLIENT_PID=$!

    # Open UI
    echo -e "\033[1mOpening webpage...\033[0m"
    if command -v xdg-open &> /dev/null; then
        xdg-open http://localhost:5173
    elif command -v open &> /dev/null; then
        open http://localhost:5173
    else
        echo -e "\033[1;33mPlease open http://localhost:5173 in your browser\033[0m"
    fi
fi

# Wait for processes
if [[ "$CLIENT_TYPE" == "web" ]]; then
    wait $SERVER_PID $CLIENT_PID
else
    wait $SERVER_PID
fi
