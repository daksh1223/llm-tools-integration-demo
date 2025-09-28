#!/usr/bin/env node
import dotenv from "dotenv";
dotenv.config();

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { localToolsForMCP, localToolsFunctions } from "./localTools.js";

const server = new McpServer({
  name: "local-mcp-server",
  version: "1.0.0",
});

localToolsForMCP.forEach((tool) =>
  server.tool(
    tool.function.name,
    tool.function.description,
    tool.function.parameters,
    async (params) => {
      const content = await localToolsFunctions[tool.function.name](params);
      return {
        content: [{ type: "text", text: JSON.stringify(content) }],
      };
    }
  )
);

const transport = new StdioServerTransport();
await server.connect(transport);
