// Check Gateway unified balance across domains
import dotenv from "dotenv";
dotenv.config();

const GATEWAY_API = "https://gateway-api-testnet.circle.com";
const CAST = process.env.CAST_ADDRESS;

const domains = [
  { id: 0, name: "ETH Sepolia" },
  { id: 26, name: "Arc Testnet" },
];

export async function getGatewayBalances(address) {
  const sources = domains.map(d => ({ domain: d.id, depositor: address }));
  const res = await fetch(`${GATEWAY_API}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources }),
  });
  const data = await res.json();
  return (data.balances || []).map((b, i) => ({
    domain: domains[i].name,
    domainId: domains[i].id,
    balance: b.balance || "0",
  }));
}

if (process.argv[1]?.endsWith("gateway-balance.mjs")) {
  console.log("=== Gateway Unified Balance ===");
  console.log(`Address: ${CAST}\n`);
  const balances = await getGatewayBalances(CAST);
  let total = 0;
  for (const b of balances) {
    console.log(`  ${b.domain.padEnd(15)} ${b.balance} USDC`);
    total += parseFloat(b.balance);
  }
  console.log(`  ${"TOTAL".padEnd(15)} ${total.toFixed(6)} USDC`);
}
