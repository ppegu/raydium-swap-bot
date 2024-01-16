import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import base58 from "bs58";
import { config } from "dotenv";
import { SwapRaydiumLp } from "../raydium-swap";

config();

const payer = Keypair.fromSecretKey(
  base58.decode(String(process.env.WALLET_SECRET_KEY))
);

if (!payer)
  throw new Error("WALLET_SECRET_KEY error please check before using.");

export class SwapBot {
  scriptExecuted = 0;

  totalOrdersPlaced = 0;

  BUY_ORDER_AMOUNT: string | undefined;
  BUY_ORDER_NO: string | undefined;
  SELL_ORDER_AMOUNT: string | undefined;
  SELL_ORDER_NO: string | undefined;
  ORDER_INTERVAL: string | undefined;
  REPEAR_STEP: string | undefined;
  connection: Connection = new Connection(clusterApiUrl("mainnet-beta"));
  payer: Keypair = payer;

  constructor() {
    this.BUY_ORDER_AMOUNT = process.env.BUY_ORDER_AMOUNT;
    this.BUY_ORDER_NO = process.env.BUY_ORDER_NO;
    this.SELL_ORDER_AMOUNT = process.env.SELL_ORDER_AMOUNT;
    this.SELL_ORDER_NO = process.env.SELL_ORDER_NO;
    this.ORDER_INTERVAL = process.env.ORDER_INTERVAL;
    this.REPEAR_STEP = process.env.REPEAR_STEP;
  }

  async sleep(time: number) {
    console.log("sleeping:", time, "ms");
    return new Promise((rs) => {
      setTimeout(rs, time); // ms
    });
  }

  interleaveArrays(arr1: any[], arr2: any[]) {
    const result = [];
    for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
      if (i < arr1.length) {
        result.push(arr1[i]);
      }
      if (i < arr2.length) {
        result.push(arr2[i]);
      }
    }
    return result;
  }

  getShuffledOrders() {
    const buys = Array.from(Array(Number(this.BUY_ORDER_NO))).map((_) => "buy");
    const sells = Array.from(Array(Number(this.SELL_ORDER_NO))).map(
      (_) => "sell"
    );
    const shuffle = this.interleaveArrays(buys, sells);
    return shuffle;
  }

  async createBuyorder() {
    console.log("Creating buy order for", this.totalOrdersPlaced);

    const resp = await SwapRaydiumLp(
      this.connection,
      payer,
      Number(this.BUY_ORDER_AMOUNT), // in SOL
      "in"
    );

    console.log("buy order created:", resp);
  }

  async createSellOrder() {
    console.log("Creating sell order for", this.totalOrdersPlaced);
    const resp = await SwapRaydiumLp(
      this.connection,
      payer,
      Number(this.SELL_ORDER_AMOUNT) / Number(this.SELL_ORDER_NO), //in SOL
      "out"
    );
    console.log("sell order created:", resp);
  }

  async startProcess() {
    if (this.scriptExecuted >= Number(this.REPEAR_STEP)) {
      console.log("script executed:", this.scriptExecuted, "times");
      return;
    }

    const orders = this.getShuffledOrders();

    /**for each order now call order function */

    for (const direction of orders) {
      this.totalOrdersPlaced += 1;
      if (direction === "buy") await this.createBuyorder();
      else if (direction === "sell") await this.createSellOrder();
      await this.sleep(Number(this.ORDER_INTERVAL));
    }

    this.scriptExecuted += 1;

    await this.startProcess();
  }
}
