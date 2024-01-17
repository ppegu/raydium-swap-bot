import dotenv from "dotenv";
import { SwapBot } from "./bot";

dotenv.config();

async function main() {
  const bot = new SwapBot();

  while (true) {
    try {
      await bot.startProcess();
    } catch (e) {
      console.log(e, "Error occurred, restarting process...");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main().catch((e) => {
  console.log("Fatal error, unable to continue:", e);
});
