import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.8/colors";
export async function handleServiceInit(
  tempPath: string,
  serviceName: string,
) {
  // Remove .git directory
  console.log(colors.dim("🗑️  Removing .git directory..."));
  const gitDir = `${tempPath}${Deno.build.os === "windows" ? "\\" : "/"}.git`;
  try {
    await Deno.remove(gitDir, { recursive: true });
  } catch (error) {
    console.log(
      colors.yellow(
        `⚠️  Could not remove .git directory: ${error}`,
      ),
    );
  }
  // rename the service.json name to the serviceName
  const serviceJsonPath = `${tempPath}${
    Deno.build.os === "windows" ? "\\" : "/"
  }service.json`;
  const serviceJson = JSON.parse(
    await Deno.readTextFile(serviceJsonPath),
  );
  serviceJson.name = serviceName;
  await Deno.writeTextFile(
    serviceJsonPath,
    JSON.stringify(serviceJson, null, 2),
  );
}
