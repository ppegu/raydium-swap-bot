import dotenv from "dotenv";
import { SwapBot } from "./bot";

dotenv.config();

async function main() {
  const bot = new SwapBot();

  while (true) {
    try {
      await bot.startProcess();
      // If you want some delay between each run, you can use:
      // await new Promise(resolve => setTimeout(resolve, delayInMilliseconds));
    } catch (e) {
      console.log(e, "Error occurred, restarting process...");
      // Optional: Add some delay before restarting to avoid rapid failure loops
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main().catch((e) => {
  console.log("Fatal error, unable to continue:", e);
});
