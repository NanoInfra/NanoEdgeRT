import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
import { createFunctionProject } from "./new/function.ts";
import { createStreamFunctionProject } from "./new/stream-function.ts";
import { handleServiceInit } from "./new/service.ts";

function getHomeDirectory(): string {
  if (Deno.build.os === "windows") {
    return Deno.env.get("USERPROFILE") || "C:\\";
  } else {
    return Deno.env.get("HOME") || "/";
  }
}

// Get the projects directory path
function getProjectsDirectory(): string {
  const homeDir = getHomeDirectory();
  const sep = Deno.build.os === "windows" ? "\\" : "/";
  return `${homeDir}${sep}.nanovibe${sep}projects`;
}

// Template configurations
const templates = {
  service: {
    url: "https://github.com/NanoInfra/NanoServiceExample.git",
    description: "Create a new service project",
  },
  function: null,
  "stream-function": null,
};

// New project command
export const newCommand = new Command()
  .description(
    `${colors.brightCyan("🚀 Create a new NanoEdge project")}\n\n` +
      `${colors.brightYellow("📋 Available types:")}\n` +
      // `  ${colors.green("•")} ${colors.brightBlue("frontend")}      ${
      //   colors.dim("- Deno Preact frontend project")
      // }\n` +
      // `  ${colors.green("•")} ${colors.brightBlue("frontend-vite")} ${
      //   colors.dim("- Deno Vite-based frontend")
      // }\n` +
      `  ${colors.green("•")} ${colors.brightBlue("service")}       ${
        colors.dim("- NanoEdgeRT Backend service project")
      }\n` +
      `  ${colors.green("•")} ${colors.brightBlue("function")}      ${
        colors.dim("- NanoEdgeRT Serverless function project")
      }\n\n` +
      `  ${colors.green("•")} ${colors.brightBlue("stream-function")}      ${
        colors.dim("- NanoEdgeRT Serverless stream-function project")
      }\n\n` +
      `${colors.brightYellow("💡 Example:")} ${
        colors.brightGreen("nanocli new service my_service")
      }\n\n` +
      `${colors.brightYellow("📁 Location:")} ${colors.dim("~/.nanovibe/projects/<NAME>")}\n` +
      `${colors.brightYellow("🔗 Source:")} ${
        colors.dim(
          "Clones template from GitHub and sets up project structure",
        )
      }`,
  )
  .arguments("<type:string> <name:string>")
  .action(async (_options: unknown, type: string, name: string) => {
    console.log(colors.brightBlue("🚀 Creating new NanoEdge project..."));

    // Validate project type
    if (!Object.keys(templates).includes(type)) {
      console.error(colors.red(`❌ Invalid project type: ${type}`));
      console.log(
        colors.yellow("Available types: frontend, service, function"),
      );
      Deno.exit(1);
    }

    // Validate project name
    if (!name || !(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name))) {
      console.error(colors.red("❌ Project name is not valid"));
      Deno.exit(1);
    }

    const template = templates[type as keyof typeof templates];
    const projectsDir = getProjectsDirectory();
    const projectPath = `${projectsDir}${Deno.build.os === "windows" ? "\\" : "/"}${name}`;
    const tempPath = `${projectsDir}${Deno.build.os === "windows" ? "\\" : "/"}temp_${name}`;

    try {
      // Create projects directory if it doesn't exist
      console.log(
        colors.dim(
          `📁 Ensuring projects directory exists: ${projectsDir}`,
        ),
      );
      await Deno.mkdir(projectsDir, { recursive: true });

      // Check if project already exists
      try {
        await Deno.stat(projectPath);
        console.error(
          colors.red(
            `❌ Project '${name}' already exists at ${projectPath}`,
          ),
        );
        Deno.exit(1);
      } catch {
        // Project doesn't exist, continue
      }

      if (type === "function") {
        await createFunctionProject(projectPath, name);
      } else if (type === "stream-function") {
        await createStreamFunctionProject(projectPath, name);
      } else if (template === null) {
        console.error(colors.red(`❌ No template available for type: ${type}`));
        Deno.exit(1);
      } else {
        if (type === "service") {
          await handleServiceInit(tempPath, name);
        }

        // Clone the template repository
        console.log(
          colors.dim(`📥 Cloning template from ${template.url}...`),
        );
        const cloneProcess = new Deno.Command("git", {
          args: ["clone", template.url, tempPath],
          stdout: "piped",
          stderr: "piped",
        });

        const cloneResult = await cloneProcess.output();
        if (!cloneResult.success) {
          const error = new TextDecoder().decode(cloneResult.stderr);
          console.error(
            colors.red(`❌ Failed to clone template: ${error}`),
          );
          Deno.exit(1);
        }

        // Handle frontend-specific template replacements
        console.log(colors.dim("🔧 Configuring MOCK"));
        // TODO: Implement frontend-specific configuration if needed

        // Rename the directory to the project name
        console.log(colors.dim(`📦 Finalizing project structure...`));
        await Deno.rename(tempPath, projectPath);
      }

      // Success message
      console.log(
        colors.green(
          `✅ Successfully created ${type} project: ${name}`,
        ),
      );
      console.log(colors.dim(`📍 Project location: ${projectPath}`));
      console.log(colors.brightBlue(`\n🎉 Next steps:`));
      console.log(colors.dim(`   cd ${projectPath}`));
      console.log(
        colors.dim(`   # Start developing your ${type} project!`),
      );
    } catch (error) {
      console.error(colors.red(`❌ Failed to create project: ${error}`));

      // Cleanup on failure
      try {
        await Deno.remove(tempPath, { recursive: true });
        await Deno.remove(projectPath, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }

      Deno.exit(1);
    }
  });
