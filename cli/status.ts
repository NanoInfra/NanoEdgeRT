import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
import { Table } from "jsr:@cliffy/table@^1.0.0-rc.8";
import { renderLogo } from "./mod.ts";

export const statusCommand = new Command()
  .description("🩺 Check server health status")
  // deno-lint-ignore no-explicit-any
  .action(async (options: any) => {
    const baseUrl = `http://${options.host}:${options.port}`;

    try {
      const r = await fetch(`${baseUrl}/health`);
      if (!r.ok) {
        throw new Error(`HTTP error! Status: ${r.status}`);
      }
      console.log(renderLogo());
      const data = await r.json();
      console.log(colors.brightBlue("🏥 Server Health Status:"));
      console.log(
        `   Status: ${
          data.status === "ok" ? colors.green("✅ " + data.status) : colors.red("❌ " + data.status)
        }`,
      );
      console.log(`   Start Time: ${colors.dim(data.startTime)}`);
      console.log(
        `   Services: ${colors.cyan(data.services.length.toString())}`,
      );

      if (data.services.length > 0) {
        console.log("\n📊 Services:");
        const table = new Table()
          .header(["Status", "Name", "Port"])
          .border(true);

        for (const service of data.services) {
          const status = service.status === "running"
            ? colors.green("🟢 Running")
            : colors.red("🔴 Stopped");
          table.push([status, service.name, service.port?.toString() || "N/A"]);
        }

        table.render();
      }
    } catch (error) {
      console.error(
        colors.red("❌ Failed to check health:"),
        (error as Error).message,
      );
      Deno.exit(1);
    }
  });
