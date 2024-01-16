import {
  ModelDataPubkey,
  jsonInfo2PoolKeys,
  parseBigNumberish,
  struct,
  u64,
  u8,
  type LiquidityPoolKeysV4,
} from "@raydium-io/raydium-sdk";
import * as SplToken from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import lpJson from "../lp_json.json";
import {
  getAccount,
  getAmountInOut,
  getAssociatedTokenAddressSync,
  getCurrencyInOut,
} from "./utils";

const poolKeys = jsonInfo2PoolKeys(lpJson) as LiquidityPoolKeysV4;

async function getAtaInstruction(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey
) {
  const associatedToken = getAssociatedTokenAddressSync(mint, owner);

  let createAtaInstruction;
  try {
    await getAccount(connection, associatedToken);
  } catch (error) {
    if (
      error instanceof SplToken.TokenAccountNotFoundError ||
      error instanceof SplToken.TokenInvalidAccountOwnerError
    ) {
      createAtaInstruction = SplToken.createAssociatedTokenAccountInstruction(
        owner,
        associatedToken,
        owner,
        mint
      );
    } else throw error;
  }

  return createAtaInstruction;
}

export async function SwapRaydiumLp(
  connection: Connection,
  payer: Keypair,
  amount: number,
  direction: "in" | "out"
) {
  try {
    const transaction = new Transaction();

    const blockhash = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash.blockhash;
    transaction.lastValidBlockHeight = blockhash.lastValidBlockHeight;

    const { currencyInMint, currencyOutMint } = getCurrencyInOut(
      poolKeys,
      direction
    );

    const amountInAtaInstruction = await getAtaInstruction(
      connection,
      currencyInMint,
      payer.publicKey
    );
    if (amountInAtaInstruction) transaction.add(amountInAtaInstruction);

    const amountOutAtaInstruction = await getAtaInstruction(
      connection,
      currencyOutMint,
      payer.publicKey
    );
    if (amountOutAtaInstruction) transaction.add(amountOutAtaInstruction);

    const { amountIn, amountOut } = await getAmountInOut(
      connection,
      poolKeys,
      amount,
      direction
    );

    const amountInAta = SplToken.getAssociatedTokenAddressSync(
      currencyInMint,
      payer.publicKey
    );

    const amountOutAta = SplToken.getAssociatedTokenAddressSync(
      currencyOutMint,
      payer.publicKey
    );

    if (direction === "in") {
      const solTransferInstruction = SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: amountInAta,
        lamports: amountIn.numerator.toNumber(),
      });
      transaction.add(solTransferInstruction);

      const syncAccountinstruction =
        SplToken.createSyncNativeInstruction(amountInAta);

      transaction.add(syncAccountinstruction);
    }

    const LAYOUT = struct([
      u8("instruction"),
      u64("amountIn"),
      u64("minAmountOut"),
    ]);
    const data = Buffer.alloc(LAYOUT.span);
    LAYOUT.encode(
      {
        instruction: 9,
        amountIn: parseBigNumberish(amountIn.numerator.toNumber()),
        minAmountOut: parseBigNumberish(amountOut.numerator.toNumber()),
      },
      data
    );

    const keys = [
      {
        pubkey: SplToken.TOKEN_PROGRAM_ID,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: poolKeys.id,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.authority,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: poolKeys.openOrders,
        isWritable: true,
        isSigner: false,
      },
    ];

    keys.push({
      pubkey: poolKeys.targetOrders,
      isWritable: true,
      isSigner: false,
    });

    keys.push(
      {
        pubkey: poolKeys.baseVault,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.quoteVault,
        isWritable: true,
        isSigner: false,
      }
    );

    keys.push(
      {
        pubkey: poolKeys.marketProgramId,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketId,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketBids,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketAsks,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketEventQueue,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketBaseVault,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketQuoteVault,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: poolKeys.marketAuthority,
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: amountInAta,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: amountOutAta,
        isWritable: true,
        isSigner: false,
      },
      {
        pubkey: payer.publicKey,
        isWritable: false,
        isSigner: true,
      }
    );

    const instruction = new TransactionInstruction({
      programId: poolKeys.programId,
      keys,
      data,
    });

    transaction.add(instruction);

    const closedAccountInstruction = SplToken.createCloseAccountInstruction(
      direction === "in" ? amountInAta : amountOutAta,
      payer.publicKey,
      payer.publicKey
    );
    transaction.add(closedAccountInstruction);

    if (transaction.instructions.length === 0) {
      console.log("no instruction");
      return;
    }

    console.log("Sending...");
    return connection.sendTransaction(transaction, [payer]);
  } catch (error: any) {
    const exactError = error.logs?.filter(
      (l: string) => l.includes("Error:") || l.includes("insufficient")
    )[0];
    console.error("error:", exactError || error.message);
  }
}
