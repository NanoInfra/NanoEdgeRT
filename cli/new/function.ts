export async function createFunctionProject(
  projectPath: string,
  functionName: string,
) {
  const deno_json = {
    "tasks": {
      "run": "deno run --allow-net entry.ts",
      "bundle": "deno bundle ./main.ts -o ./main.js",
    },
    "unstable": [
      "worker-options",
    ],
    "imports": {},
  };

  const entryTs = `
import main from "./main.ts";

Deno.serve({ port: 10001 }, async (req) => {
  const json = await req.json();
  const response = await main(json);
  return new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json" },
  });
});
`.trimStart();

  const mainTs = `
export default async function ${functionName}(config: Record<string, unknown>) : Promise<object> {
  console.log("Function executed with config:", config);
  // Add your function logic here
  return {};
}
`.trimStart();

  const vscodeJson = {
    "deno.enable": true,
    "deno.lint": true,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "denoland.vscode-deno",
    "deno.unstable": [
      "worker-options",
    ],
    "[typescriptreact]": {
      "editor.defaultFormatter": "denoland.vscode-deno",
    },
    "[typescript]": {
      "editor.defaultFormatter": "denoland.vscode-deno",
    },
    "[javascriptreact]": {
      "editor.defaultFormatter": "denoland.vscode-deno",
    },
    "[javascript]": {
      "editor.defaultFormatter": "denoland.vscode-deno",
    },
  };

  // Create project directory
  await Deno.mkdir(projectPath, { recursive: true });
  console.log(`📁 Created project directory: ${projectPath}`);
  // Create deno.json file
  await Deno.writeTextFile(
    `${projectPath}/deno.json`,
    JSON.stringify(deno_json, null, 2),
  );
  console.log(`📄 Created deno.json file in: ${projectPath}`);
  // Create entry.ts file
  await Deno.writeTextFile(`${projectPath}/entry.ts`, entryTs);
  console.log(`📄 Created entry.ts file in: ${projectPath}`);
  // Create main.ts file
  await Deno.writeTextFile(`${projectPath}/main.ts`, mainTs);
  console.log(`📄 Created main.ts file in: ${projectPath}`);
  // Create .vscode directory and settings.json
  const vscodeDir = `${projectPath}/.vscode`;
  await Deno.mkdir(vscodeDir, { recursive: true });
  await Deno.writeTextFile(
    `${vscodeDir}/settings.json`,
    JSON.stringify(vscodeJson, null, 2),
  );
  console.log(`📁 Created .vscode/settings.json in: ${vscodeDir}`);
  console.log(
    `✅ Function project '${functionName}' created successfully at ${projectPath}`,
  );
  console.log(
    `
🚀 You can now run your function with: deno task run' then fetch with:
    
    curl -X POST http://localhost:10001 -H "Content-Type: application/json" -d '{"a":1}'

or on windows you can:

    Invoke-WebRequest -Uri http://localhost:10001 -Method POST -Body '{"a":1}' -ContentType "application/json"
    `,
  );
}
