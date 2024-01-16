import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Liquidity,
  Percent,
  TOKEN_PROGRAM_ID,
  Token,
  TokenAmount,
  type LiquidityPoolInfo,
  type LiquidityPoolKeysV4,
} from "@raydium-io/raydium-sdk";
import {
  TokenOwnerOffCurveError,
  type Account,
  unpackAccount,
} from "@solana/spl-token";
import { Connection, PublicKey, type Commitment } from "@solana/web3.js";

export async function getAccount(
  connection: Connection,
  address: PublicKey,
  commitment?: Commitment,
  programId = TOKEN_PROGRAM_ID
): Promise<Account> {
  const info = await connection.getAccountInfo(address, commitment);
  return unpackAccount(address, info, programId);
}

export function getAssociatedTokenAddressSync(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
  programId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
): PublicKey {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer()))
    throw new TokenOwnerOffCurveError();
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId
  );
  return address;
}

export function getCurrencyInOut(
  poolKeys: LiquidityPoolKeysV4,
  direction: "in" | "out"
) {
  let currencyInMint = poolKeys.quoteMint;
  let currencyOutMint = poolKeys.baseMint;

  let currencyInDecimals = poolKeys.quoteDecimals;
  let currencyOutDecimals = poolKeys.baseDecimals;

  if (direction === "out") {
    currencyInMint = poolKeys.baseMint;
    currencyOutMint = poolKeys.quoteMint;

    currencyInDecimals = poolKeys.baseDecimals;
    currencyOutDecimals = poolKeys.quoteDecimals;
  }

  let currencyIn = new Token(
    poolKeys.marketProgramId,
    currencyInMint,
    currencyInDecimals
  );

  let currencyOut = new Token(
    poolKeys.marketProgramId,
    currencyOutMint,
    currencyOutDecimals
  );

  return {
    currencyIn,
    currencyOut,
    currencyInDecimals,
    currencyOutDecimals,
    currencyInMint,
    currencyOutMint,
  };
}

/**rawAmount: in SOL
 * only for out direction
 */
export function getActualRawAmount(
  connection: Connection,
  poolKeys: LiquidityPoolKeysV4,
  poolInfo: LiquidityPoolInfo,
  rawAmount: number // in SOL
) {
  const { currencyIn, currencyOut, currencyInDecimals } = getCurrencyInOut(
    poolKeys,
    "out"
  );

  let amountIn = new TokenAmount(currencyIn, 1, false);

  const slippage = new Percent(0, 100); // 5% slippage

  const { amountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn,
    currencyOut,
    slippage,
  });

  const actualRawAmount =
    (rawAmount * Math.pow(10, currencyInDecimals + 1)) /
    amountOut.numerator.toNumber();

  console.log("actualRawAmount", actualRawAmount);

  return actualRawAmount;
}

export async function getAmountInOut(
  connection: Connection,
  poolKeys: LiquidityPoolKeysV4,
  rawAmount: number,
  direction: "in" | "out"
) {
  const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

  let actualRawAmount = rawAmount;

  if (direction === "out") {
    actualRawAmount = getActualRawAmount(
      connection,
      poolKeys,
      poolInfo,
      rawAmount
    );
  }

  const { currencyIn, currencyOut } = getCurrencyInOut(poolKeys, direction);

  let amountIn = new TokenAmount(currencyIn, actualRawAmount, false);

  const slippage = new Percent(0, 100); // 5% slippage

  const { amountOut } = Liquidity.computeAmountOut({
    poolKeys,
    poolInfo,
    amountIn,
    currencyOut,
    slippage,
  });

  return { amountIn, amountOut };
}
