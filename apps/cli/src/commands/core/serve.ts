import { Gateway } from "@director.run/gateway/gateway";
import { DirectorCommand } from "@director.run/utilities/cli/director-command";
import {
  actionWithErrorHandler,
  printDirectorAscii,
} from "@director.run/utilities/cli/index";
import { Telemetry } from "@director.run/utilities/telemetry";
import packageJson from "../../../package.json";
import { env } from "../../env";

export function registerServeCommand(program: DirectorCommand) {
  program
    .command("serve")
    .description("Start the web service")
    .action(
      actionWithErrorHandler(async () => {
        try {
          await startGateway();
        } catch (error) {
          console.error("Fatal error starting gateway", error);
          process.exit(1);
        }
      }),
    );
}

export async function startGateway(successCallback?: () => void) {
  console.log(`v${packageJson.version}`);
  printDirectorAscii();

  await Gateway.start(
    {
      port: env.GATEWAY_PORT,
      databaseFilePath: env.CONFIG_FILE_PATH,
      registryURL: env.REGISTRY_API_URL,
      allowedOrigins: [env.STUDIO_URL, /^https?:\/\/localhost(:\d+)?$/],
      telemetry: new Telemetry({
        writeKey: env.SEGMENT_WRITE_KEY,
        enabled: env.SEND_TELEMETRY,
        traits: {
          cliVersion: packageJson.version,
        },
      }),
    },
    successCallback,
  );
}
