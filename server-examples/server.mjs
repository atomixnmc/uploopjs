import { createApp } from "./app.mjs";

const app = createApp();
app.listen(3500, () => {
  console.log("");
  console.log(
    `[${new Date().toLocaleTimeString()}] Server ready — watching for changes...`,
  );
  console.log("⚡ Uploop SST Dev Server");
  console.log("   http://localhost:3500");
  console.log("   Hot reload: edit any file, server restarts automatically");
  console.log("");
});
