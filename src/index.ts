import { server } from "#app.js";
import env from "#config/env.js";

const PORT = Number(env.PORT) || 3000;

server.listen(PORT, () => {
  console.log("Server is running on port " + String(PORT));
});
