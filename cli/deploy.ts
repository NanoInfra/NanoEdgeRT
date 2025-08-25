import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";

export const deployCommand = new Command()
  .description(
    `${colors.brightCyan("🚀 Deploy your NanoEdge project")}\n\n` +
      `${colors.brightYellow("🎯 Deployment targets:")}\n` +
      `  ${colors.green("•")} ${colors.brightBlue("local")}         ${
        colors.dim("- Deploy to local NanoEdge instance")
      }\n` +
      `  ${colors.green("•")} ${colors.brightBlue("cloud")}         ${
        colors.dim("- Deploy to NanoEdge Cloud platform")
      }\n` +
      `${colors.brightYellow("📋 Project types:")}\n` +
      `  ${colors.green("•")} ${colors.brightBlue("frontend")}      ${
        colors.dim("- Deploy frontend application")
      }\n` +
      `  ${colors.green("•")} ${colors.brightBlue("service")}       ${
        colors.dim("- Deploy backend service")
      }\n` +
      `  ${colors.green("•")} ${colors.brightBlue("function")}      ${
        colors.dim("- Deploy serverless function/stream-function")
      }\n\n` +
      `${colors.brightYellow("💡 Example:")} ${
        colors.brightGreen("nanocli deploy local frontend .")
      }\n` +
      `${colors.brightYellow("💡 Example:")} ${
        colors.brightGreen("nanocli deploy cloud service ./my-service")
      }\n\n` +
      `${colors.brightYellow("📦 Process:")} ${
        colors.dim("Build → Package → Upload → Start")
      }\n`,
  )
  .arguments("<target:string> <type:string> <dir:file>")
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, target: string, type: string, dir: string) => {
    if (target !== "local") {
      console.log(
        colors.yellow("⚠️  Deploy cloud command not yet implemented"),
      );
    } else {
      if (!_options.host || !_options.port) {
        console.error(
          colors.red("❌ Missing required options: --host, --port"),
        );
        Deno.exit(1);
      } else {
        const token = await ((async () => {
          const token = await fetch(
            `http://localhost:8000/jwt/create`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
            },
          );
          if (!token.ok) {
            console.error(
              colors.red(
                `❌ Failed to create token: ${token.status} ${token.statusText}`,
              ),
            );
            Deno.exit(1);
          }
          const data = await token.json();
          return data.token;
        })());

        // check if exists
        const allServices = await fetch(
          `http://${_options.host}:${_options.port}/admin-api/v2/services`,
          {
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          },
        );
        if (!allServices.ok) {
          console.error(
            colors.red(
              `❌ Failed to fetch services: ${allServices.status} ${allServices.statusText}`,
            ),
          );
          Deno.exit(1);
        }

        switch (type) {
          case "frontend":
            console.log(colors.brightBlue("🚀 Deploying frontend..."));
            console.error(
              colors.yellow("⚠️  Frontend deployment not yet implemented"),
            );
            break;
          case "service": {
            console.log(colors.brightBlue("🚀 Deploying service..."));
            // first run bundle
            console.log(colors.brightBlue("🔧 Bundling service..."));
            const bundleCommand = new Deno.Command(
              "deno",
              {
                args: [
                  "run",
                  "bundle",
                ],
                cwd: dir,
              },
            );
            const { code: exitCode, stderr } = await bundleCommand
              .output();
            if (exitCode !== 0) {
              console.error(
                colors.red("❌ Failed to bundle service:"),
                stderr,
              );
              Deno.exit(1);
            }
            console.log(colors.green("✅ Service bundled successfully"));

            const code = await Deno.readTextFile(`${dir}/main.js`);
            const schema = await Deno.readTextFile(`${dir}/openapi.json`);
            const serviceJson = JSON.parse(
              await Deno.readTextFile(`${dir}/service.json`),
            );
            serviceJson.code = code;
            serviceJson.schema = schema;
            // check if service already exists
            const services = await allServices.json();
            if (
              // deno-lint-ignore no-explicit-any
              services.services.some((s: any) => s.name === serviceJson.name)
            ) {
              console.error(
                colors.red(`❌ Service already exists: ${serviceJson.name}`),
              );
              console.log(
                colors.dim(
                  `📝 If you want to update the service, use 'nanocli update service ${serviceJson.name} ${dir}'`,
                ),
              );
              Deno.exit(1);
            }
            console.log(
              colors.brightBlue("📦 Uploading service package..."),
            );
            const res = await fetch(
              `http://${_options.host}:${_options.port}/admin-api/v2/services`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${_options.token}`,
                },
                body: JSON.stringify(serviceJson),
              },
            );
            if (!res.ok) {
              console.error(
                colors.red("❌ Failed to upload service package:"),
                await res.text(),
              );
              Deno.exit(1);
            }
            console.log(
              colors.green("✅ Service package uploaded successfully"),
            );
            break;
          }
          case "function":
            console.log(colors.brightBlue("🚀 Deploying function..."));
            break;
          default:
            console.error(
              colors.red(
                `❌ Unknown project type: ${type}, expected frontend, service, or function`,
              ),
            );
            Deno.exit(1);
        }
      }
    }
  });
