#!/usr/bin/env -S deno run --allow-all

import { NanoEdgeRT } from "./src/nanoedge.ts";

async function main() {
  const configPath = Deno.args[0] || "./nanoedge/config.json";

  try {
    const nanoEdge = await NanoEdgeRT.create(configPath);

    // Handle graceful shutdown
    const handleShutdown = () => {
      console.log("\n🛑 Received shutdown signal...");
      nanoEdge.stop();
      Deno.exit(0);
    };

    // Listen for shutdown signals
    Deno.addSignalListener("SIGINT", handleShutdown);
    Deno.addSignalListener("SIGTERM", handleShutdown);

    await nanoEdge.start();
  } catch (error) {
    console.error(
      "❌ Failed to start NanoEdgeRT:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
