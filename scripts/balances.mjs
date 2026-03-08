// Query all wallet balances across Arc Testnet and ETH Sepolia
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, http } from "viem";
import dotenv from "dotenv";
dotenv.config();

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET,
});

const USDC_ARC = "0x3600000000000000000000000000000000000000";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const EURC_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const arcClient = createPublicClient({ transport: http("https://rpc.testnet.arc.network") });
const sepoliaClient = createPublicClient({ transport: http("https://rpc.sepolia.org") });

const ERC20_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }];

async function getOnChainBalance(publicClient, token, address, decimals = 6) {
  try {
    const bal = await publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [address] });
    return (Number(bal) / 10 ** decimals).toFixed(decimals);
  } catch { return "0.000000"; }
}

async function getCircleBalance(walletId) {
  try {
    const res = await client.getWalletTokenBalance({ id: walletId });
    return res.data?.tokenBalances || [];
  } catch { return []; }
}

export async function getAllBalances() {
  const wallets = [
    { name: "Cast Wallet", address: process.env.CAST_ADDRESS, arcId: null, sepoliaId: null },
    { name: "Wallet 1", address: process.env.WALLET1_ADDRESS, arcId: process.env.WALLET1_ARC_ID, sepoliaId: process.env.WALLET1_SEPOLIA_ID },
    { name: "Wallet 2", address: process.env.WALLET2_ADDRESS, arcId: process.env.WALLET2_ARC_ID, sepoliaId: process.env.WALLET2_SEPOLIA_ID },
    { name: "SCA Wallet", address: process.env.SCA_WALLET_ADDRESS, arcId: process.env.SCA_WALLET_ID, sepoliaId: null },
  ];

  const results = [];
  for (const w of wallets) {
    const arcUSDC = await getOnChainBalance(arcClient, USDC_ARC, w.address);
    const arcEURC = await getOnChainBalance(arcClient, EURC_ARC, w.address);

    let sepoliaUSDC = "0.000000";
    if (w.sepoliaId) {
      const bals = await getCircleBalance(w.sepoliaId);
      const usdc = bals.find(b => b.token?.symbol === "USDC");
      if (usdc) sepoliaUSDC = parseFloat(usdc.amount).toFixed(6);
    } else {
      sepoliaUSDC = await getOnChainBalance(sepoliaClient, USDC_SEPOLIA, w.address);
    }

    results.push({
      name: w.name,
      address: w.address,
      arc: { usdc: arcUSDC, eurc: arcEURC },
      sepolia: { usdc: sepoliaUSDC },
    });
  }
  return results;
}

export function printBalances(results) {
  let totalArcUSDC = 0, totalArcEURC = 0, totalSepoliaUSDC = 0;

  console.log("\n┌────────────────┬────────────────────┬──────────────┬──────────────┬──────────────┐");
  console.log("│ Wallet         │ Address            │ Arc USDC     │ Arc EURC     │ Sep USDC     │");
  console.log("├────────────────┼────────────────────┼──────────────┼──────────────┼──────────────┤");

  for (const r of results) {
    const name = r.name.padEnd(14);
    const addr = (r.address.slice(0, 6) + "..." + r.address.slice(-4)).padEnd(18);
    const arcU = r.arc.usdc.padStart(12);
    const arcE = r.arc.eurc.padStart(12);
    const sepU = r.sepolia.usdc.padStart(12);
    console.log(`│ ${name} │ ${addr} │ ${arcU} │ ${arcE} │ ${sepU} │`);

    totalArcUSDC += parseFloat(r.arc.usdc);
    totalArcEURC += parseFloat(r.arc.eurc);
    totalSepoliaUSDC += parseFloat(r.sepolia.usdc);
  }

  console.log("├────────────────┼────────────────────┼──────────────┼──────────────┼──────────────┤");
  const totAU = totalArcUSDC.toFixed(6).padStart(12);
  const totAE = totalArcEURC.toFixed(6).padStart(12);
  const totSU = totalSepoliaUSDC.toFixed(6).padStart(12);
  console.log(`│ TOTAL          │                    │ ${totAU} │ ${totAE} │ ${totSU} │`);
  console.log("└────────────────┴────────────────────┴──────────────┴──────────────┴──────────────┘");

  return { totalArcUSDC, totalArcEURC, totalSepoliaUSDC };
}

// Run standalone
if (process.argv[1]?.endsWith("balances.mjs")) {
  console.log("=== Multi-Chain Fund Dashboard ===");
  const results = await getAllBalances();
  printBalances(results);
}
