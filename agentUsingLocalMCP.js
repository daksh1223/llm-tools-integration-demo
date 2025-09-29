import dotenv from "dotenv";
dotenv.config();

import { AzureOpenAI } from "openai";
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from "@azure/identity";

const scope = "https://cognitiveservices.azure.com/.default";

const createADOMCPClient = async () => {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@azure-devops/mcp", "domoreexp", "--domains", "all"],
  });
  const client = new Client({
    name: "example-client",
    version: "1.0.0",
  });
  await client.connect(transport);
  return client;
};

const createLocalMcpClient = async () => {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["localMCPServer"],
  });
  const client = new Client({
    name: "example-client",
    version: "1.0.0",
  });
  await client.connect(transport);
  return client;
};

const getOpenAIClient = async () => {
  const azureADTokenProvider = getBearerTokenProvider(
    new DefaultAzureCredential(),
    scope
  );

  const client = new AzureOpenAI({
    deployment: "gpt-4.1",
    apiVersion: "2025-01-01-preview",
    max_tokens: 32768,
    endpoint: process.env.AZURE_TEXT_TO_TEXT_ENDPOINT,
    apiKey: process.env.AZURE_TEXT_TO_TEXT_KEY,
  });
  return client;
};

function mcpToolsToOpenAITools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.inputSchema || { type: "object", properties: {} },
    },
  }));
}

async function getAgentResponse(messages) {
  const adoMCPClient = await createADOMCPClient();
  const localMCPClient = await createLocalMcpClient();
  const adoTools = (await adoMCPClient.listTools()).tools;
  const localTools = (await localMCPClient.listTools()).tools;
  const mcpTools = mcpToolsToOpenAITools([...adoTools, ...localTools]);

  const openAIClient = await getOpenAIClient();
  let result = await openAIClient.chat.completions.create({
    messages,
    model: "gpt-4.1",
    tools: mcpTools,
  });
  while (1) {
    const message = result.choices[0].message;
    if (message.tool_calls?.length) {
      console.log("Tool calls:", message.tool_calls);

      const toolResponses = await Promise.all(
        message.tool_calls.map(async (toolCall) => {
          const isLocalTool = localTools.find(
            (tool) => tool.name === toolCall.function.name
          );
          const args = JSON.parse(toolCall.function.arguments || "{}");

          const output = await (!!isLocalTool
            ? localMCPClient
            : adoMCPClient
          ).callTool({
            name: toolCall.function.name,
            arguments: args,
          });
          console.log("MCP Tool output:", output);
          return {
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(output.content),
          };
        })
      );
      result = await openAIClient.chat.completions.create({
        messages: [...messages, message, ...toolResponses],
        model: "gpt-4.1",
        tools: mcpTools,
      });
    } else {
      await adoMCPClient.close();
      await localMCPClient.close();
      return result.choices[0].message.content;
    }
  }
}

getAgentResponse([
  {
    role: "system",
    content:
      "You are an assistant with access to Azure DevOps via MCP tools and local tools. It might happen that you might not get the response in a single go, try out various tools again and again with different arguments before stating no response",
  },
  {
    role: "user",
    content:
      "Fetch the details of the tickets provided in tickets.json file present locally. They belong to MSTeams project and then analyse them and give me similarities among all of these tickets. Don't give superficial analysis but rather a deeper analysis. Take your time! Focus also on what's common in terms of what these tickets are trying to achieve. Provide Deeper analysis don't leave it blank!",
  },
]).then((response) => console.log(response));
