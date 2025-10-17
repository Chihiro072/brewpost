// server.ts (or index.ts)
import { loadEnvFromSecrets } from "./secret";

(async () => {
  await loadEnvFromSecrets();        // pulls once on boot
  // now process.env has your values
  // start your app (Express/Next/Nest/etc.)
})();
