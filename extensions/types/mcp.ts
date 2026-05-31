/**
 * Configuration entry for a Model Context Protocol server.
 * Maps to the mcpServers schema in .mcp.json / .pi/mcp.json.
 */
export interface McpServerConfig {
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	lifecycle?: "lazy" | "eager" | "keep-alive";
}

/**
 * A suggested MCP server to add to the project config.
 * Produced by getMcpCatalog() and filtered by buildMcpSuggestions().
 */
export interface McpSuggestion {
	serverKey: string;
	name: string;
	reason: string;
	config: McpServerConfig;
	setupHint?: string;
}
