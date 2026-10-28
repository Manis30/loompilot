import http from "http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDB } from "./config/db.js";
import { initSocketServer } from "./realtime/socket.js";

async function bootstrap() {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(env.API_PORT, env.API_HOST, () => {
      logger.info(
        { port: env.API_PORT, host: env.API_HOST, env: env.NODE_ENV },
        `${env.APP_NAME} API server running`
      );
    });
  } catch (err) {
    logger.fatal({ err }, "Failed to bootstrap server");
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  bootstrap();
}
