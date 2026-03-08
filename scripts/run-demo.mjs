// Full demo: show balances, do a transfer, show updated balances
import { getAllBalances, printBalances } from "./balances.mjs";
import { getGatewayBalances } from "./gateway-balance.mjs";
import { transferUSDC } from "./transfer.mjs";
import dotenv from "dotenv";
dotenv.config();

console.log("╔══════════════════════════════════════════╗");
console.log("║  Multi-Chain Fund Dashboard - Full Demo  ║");
console.log("╚══════════════════════════════════════════╝");

// Step 1: Show all balances
console.log("\n=== Step 1: Current Balances ===");
const before = await getAllBalances();
const totals = printBalances(before);

// Step 2: Gateway balances
console.log("\n=== Step 2: Gateway Unified Balance ===");
const gwBals = await getGatewayBalances(process.env.CAST_ADDRESS);
for (const b of gwBals) {
  console.log(`  ${b.domain.padEnd(15)} ${b.balance} USDC`);
}

// Step 3: Transfer 0.01 USDC W1 → W2 on Arc
console.log("\n=== Step 3: Transfer 0.01 USDC (W1 → W2 on Arc) ===");
try {
  await transferUSDC(process.env.WALLET1_ARC_ID, process.env.WALLET2_ADDRESS, "0.01");
  console.log("  Waiting 8s for confirmation...");
  await new Promise(r => setTimeout(r, 8000));
} catch (e) {
  console.error("  Transfer failed:", e?.response?.data?.message || e.message);
}

// Step 4: Updated balances
console.log("\n=== Step 4: Updated Balances ===");
const after = await getAllBalances();
printBalances(after);

console.log("\n╔══════════════════════════════════════════╗");
console.log("║             Demo Complete!               ║");
console.log("╚══════════════════════════════════════════╝");
