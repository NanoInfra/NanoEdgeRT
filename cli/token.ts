import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
export const tokenCommand = new Command()
  .description(
    `${colors.brightCyan("🔑 Generate or manage JWT tokens")}\n\n`,
  )
  // deno-lint-ignore no-explicit-any
  .action(async (options: any) => {
    if (!options.host || !options.port) {
      console.error(
        colors.red("❌ Missing required options: --host, --port"),
      );
      Deno.exit(1);
    } else {
      const token = await fetch(
        `http://${options.host}:${options.port}/jwt/create`,
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
      console.log(colors.green("✅ Token created successfully:"));
      console.log(colors.dim(data.token));
    }
  });
