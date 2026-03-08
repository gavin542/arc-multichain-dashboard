// Transfer USDC between wallets on Arc Testnet
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import dotenv from "dotenv";
dotenv.config();

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const USDC_ARC = "0x3600000000000000000000000000000000000000";

export async function transferUSDC(fromWalletId, toAddress, amount) {
  console.log(`  Transferring ${amount} USDC to ${toAddress.slice(0, 8)}...`);
  const tx = await client.createTransaction({
    amount: [amount.toString()],
    destinationAddress: toAddress,
    tokenAddress: USDC_ARC,
    blockchain: "ARC-TESTNET",
    walletId: fromWalletId,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });
  console.log(`  State: ${tx.data?.state}, ID: ${tx.data?.id}`);
  return tx.data;
}

// Run standalone: node transfer.mjs <fromWalletId> <toAddress> <amount>
if (process.argv[1]?.endsWith("transfer.mjs")) {
  const fromId = process.argv[2] || process.env.WALLET1_ARC_ID;
  const to = process.argv[3] || process.env.WALLET2_ADDRESS;
  const amt = process.argv[4] || "0.01";
  console.log("=== USDC Transfer on Arc ===");
  await transferUSDC(fromId, to, amt);
}
