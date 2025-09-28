import { z } from "zod";

export const localToolsForMCP = [
  {
    type: "function",
    function: {
      name: "getFileContent",
      description: "Get the content of a file from the user's file system",
      parameters: {
        filePath: z.string(),
      },
    },
  },
];
export const localTools = [
  {
    type: "function",
    function: {
      name: "getFileContent",
      description: "Get the content of a file from the user's file system",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string" },
        },
        required: ["filePath"],
      },
    },
  },
];

export const localToolsFunctions = {
  getFileContent: async (args) => {
    const fs = await import("fs").then((mod) => mod.promises);
    const data = await fs.readFile(args.filePath, "utf-8");
    return data;
  },
};

export const callLocalTool = async (toolName, args) =>
  await localToolsFunctions[toolName](args);
