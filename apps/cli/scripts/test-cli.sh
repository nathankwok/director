echo "----------------------------------------"
echo "- Resetting everything to a clean state"
echo "----------------------------------------"
echo 
rm .director/development/tokens/*
bun cli reset

echo
echo "----------------------------------------"
echo "- Creating a new proxy and installing the fetch server"
echo "----------------------------------------"
echo 

bun cli create test
bun cli add test --entry hackernews
# bun cli connect test -t claude
# bun cli add test --entry fetch
bun cli add test --name custom-fetch --command "uvx mcp-server-fetch"
# 
# Oauth
# 
# Step 1: Add an oauth target to the proxy
bun cli add test --name notion --url https://mcp.notion.com/mcp

# Step 2: authenticate
# bun cli auth test notion

# Wait for the oauth flow to complete

# Step 4: get the connection status
# bun cli get test notion

# TODO
# TODO: get the list of tools for a server
# bun cli tools list <proxy-id> <server-name>

# TODO: call a tool on a server
# bun cli tools <proxy-id> <server-name> <tool-name> <tool-args>

# TODO: update the filtering

echo
echo "----------------------------------------"
echo "- Results"
echo "----------------------------------------"
echo

echo
echo "PROXIES:"
echo 
bun cli ls

echo
echo "PROXY DETAILS:"
echo
bun cli get test
