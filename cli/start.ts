import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
import { startNanoEdgeRT, stopNanoEdgeRT } from "NanoEdgeRT/mod.ts";
export const startCommand = new Command()
  .description(
    `${colors.brightCyan("🚀 Start the NanoInfra Local Dev Engine")}\n\n` +
      `  ${colors.green("•")} ${colors.brightBlue("dbPath")}         ${
        colors.dim("- the path of the db file, default :memory:")
      }\n`,
  )
  .arguments("[dbPath:string]")
  // deno-lint-ignore no-explicit-any
  .action(async (_options: any, dbPath?: string) => {
    if (!dbPath) {
      dbPath = ":memory:";
    }
    Deno.addSignalListener("SIGINT", () => {
      console.log("\n🛑 SIGINT received, initiating graceful shutdown...");
      stopNanoEdgeRT(ac);
    });

    // if is not windows
    if (Deno.build.os !== "windows") {
      Deno.addSignalListener("SIGTERM", () => {
        console.log("\n🛑 SIGTERM received, initiating graceful shutdown...");
        stopNanoEdgeRT(ac);
      });
    }

    const ac = await startNanoEdgeRT(dbPath);
    console.log("NanoEdgeRT server is running. Press Ctrl+C to stop.");
    await new Promise((resolve) => ac.signal.addEventListener("abort", resolve));
  });
