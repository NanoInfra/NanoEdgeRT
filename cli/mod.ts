import { Command } from "jsr:@cliffy/command@^1.0.0-rc.8";
import { statusCommand } from "./status.ts";
import { newCommand } from "./new.ts";
import { deployCommand } from "./deploy.ts";
import { tokenCommand } from "./token.ts";
import { startCommand } from "./start.ts";
const logo = `
        ███████╗██████╗  ██████╗ ███████╗
        ██╔════╝██╔══██╗██╔════╝ ██╔════╝
██║  ██╗█████╗  ██║  ██║██║  ███╗█████╗  
██║  ██║██╔══╝  ██║  ██║██║   ██║██╔══╝  
██████╔╝███████╗██████╔╝╚██████╔╝███████╗
██╔═══╝ ╚══════╝╚═════╝  ╚═════╝ ╚══════╝
`;

export function renderLogo(): string {
  const lines = logo.split("\n");
  const width = Math.max(...lines.map((line) => line.length));
  let output = "";

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ratio = i / width;
      const r = Math.floor(255 - (255 * ratio));
      const g = Math.floor(200 * ratio);
      const b = Math.floor(255 - (55 * ratio));
      output += `\x1b[38;2;${r};${g};${b}m${line[i]}`;
    }
    output += "\x1b[0m\n";
  }

  return output;
}

// Main CLI command
const cli = new Command()
  .name("NanoEdge CLI")
  .version("1.1.0")
  .description(
    "A fast, lightweight, and secure 🔬 nano-Service framework for Deno 🦖",
  )
  .globalOption("--host <host:string>", "NanoEdge server host", {
    default: "127.0.0.1",
  })
  .globalOption("-p, --port <port:number>", "NanoEdge server port", {
    default: 8000,
  })
  .action(function () {
    console.log("\n" + renderLogo());
    this.showHelp();
  })
  .command("start", startCommand)
  .command("token", tokenCommand)
  .command("status", statusCommand)
  .command("new", newCommand)
  .command("deploy", deployCommand); // TODO:
// .command("update", updateCommand)
// .command("undeploy", undeployCommand)

if (import.meta.main) {
  await cli.parse(Deno.args);
}
