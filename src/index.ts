import dotenv from "dotenv";
import { SwapBot } from "./bot";

dotenv.config();

async function main() {
  const bot = new SwapBot();
  await bot.startProcess();
}

main();
