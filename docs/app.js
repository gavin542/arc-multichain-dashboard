// Multi-Chain Fund Dashboard - Web Frontend
// Queries on-chain balances via JSON-RPC, Gateway API, and MetaMask transfers

const ARC_RPC = "https://rpc.testnet.arc.network";
const SEPOLIA_RPC = "https://rpc.sepolia.org";
const GATEWAY_API = "https://gateway-api-testnet.circle.com";
const ARC_CHAIN_ID = "0x4cef52"; // 5042002

const USDC_ARC = "0x3600000000000000000000000000000000000000";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const EURC_ARC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

// balanceOf(address) selector
const BALANCE_OF = "0x70a08231";
// transfer(address,uint256) selector
const TRANSFER_SEL = "0xa9059cbb";

// Known wallets (public info only)
const WALLETS = [
  { name: "Cast Wallet",  address: "0x2eA729df4b0E44Bf1dD9C5277292641F0f7A3571" },
  { name: "Wallet 1",     address: "0xc3ac5ee4369d107ff4ef702ea130611ada0ca84c" },
  { name: "Wallet 2",     address: "0x5a548b9b6617663c4a5bdad4ffb9784baa2a46d9" },
  { name: "SCA Wallet",   address: "0x79fc936cc22344d60fa978962b3ee8d03a0a77ef" },
];

let connectedAddress = null;
let transferHistory = [];

// --- Helpers ---

function padAddress(addr) {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function hexToNumber(hex) {
  if (!hex || hex === "0x") return 0;
  return parseInt(hex, 16);
}

function formatBalance(rawHex, decimals = 6) {
  const val = hexToNumber(rawHex);
  return (val / (10 ** decimals)).toFixed(decimals);
}

function shortAddr(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function rpcCall(rpcUrl, method, params) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getTokenBalance(rpcUrl, tokenAddress, walletAddress) {
  const data = BALANCE_OF + padAddress(walletAddress);
  try {
    const result = await rpcCall(rpcUrl, "eth_call", [
      { to: tokenAddress, data },
      "latest",
    ]);
    return formatBalance(result);
  } catch {
    return "0.000000";
  }
}

// --- Balance Queries ---

async function getAllBalances() {
  const results = [];
  for (const w of WALLETS) {
    const [arcUSDC, arcEURC, sepUSDC] = await Promise.all([
      getTokenBalance(ARC_RPC, USDC_ARC, w.address),
      getTokenBalance(ARC_RPC, EURC_ARC, w.address),
      getTokenBalance(SEPOLIA_RPC, USDC_SEPOLIA, w.address),
    ]);
    results.push({
      name: w.name,
      address: w.address,
      arcUSDC, arcEURC, sepUSDC,
    });
  }
  return results;
}

function renderBalances(results) {
  const tbody = document.getElementById("balancesBody");
  const tfoot = document.getElementById("balancesFoot");
  let totalArc = 0, totalEurc = 0, totalSep = 0;

  tbody.innerHTML = results.map(r => {
    totalArc += parseFloat(r.arcUSDC);
    totalEurc += parseFloat(r.arcEURC);
    totalSep += parseFloat(r.sepUSDC);
    return `<tr>
      <td>${r.name}</td>
      <td title="${r.address}">${shortAddr(r.address)}</td>
      <td>${r.arcUSDC}</td>
      <td>${r.arcEURC}</td>
      <td>${r.sepUSDC}</td>
    </tr>`;
  }).join("");

  tfoot.innerHTML = `<tr>
    <td colspan="2"><strong>TOTAL</strong></td>
    <td>${totalArc.toFixed(6)}</td>
    <td>${totalEurc.toFixed(6)}</td>
    <td>${totalSep.toFixed(6)}</td>
  </tr>`;

  // Update summary cards
  document.getElementById("totalArcUSDC").textContent = totalArc.toFixed(6);
  document.getElementById("totalArcEURC").textContent = totalEurc.toFixed(6);
  document.getElementById("totalSepUSDC").textContent = totalSep.toFixed(6);
  const totalUSD = totalArc + totalEurc + totalSep;
  document.getElementById("totalUSD").textContent = "$" + totalUSD.toFixed(6);
}

async function refreshBalances() {
  const tbody = document.getElementById("balancesBody");
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Refreshing...</td></tr>';
  try {
    const results = await getAllBalances();
    renderBalances(results);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Error: ${e.message}</td></tr>`;
  }
}

// --- Gateway ---

async function getGatewayBalances(address) {
  const domains = [
    { id: 0, name: "ETH Sepolia" },
    { id: 26, name: "Arc Testnet" },
  ];
  const sources = domains.map(d => ({ domain: d.id, depositor: address }));
  const res = await fetch(`${GATEWAY_API}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources }),
  });
  const data = await res.json();
  return (data.balances || []).map((b, i) => ({
    domain: domains[i].name,
    balance: b.balance || "0",
  }));
}

async function refreshGateway() {
  const castAddr = WALLETS[0].address;
  document.getElementById("gwAddress").textContent = shortAddr(castAddr);
  const tbody = document.getElementById("gatewayBody");
  tbody.innerHTML = '<tr><td colspan="2" class="loading">Loading...</td></tr>';
  try {
    const balances = await getGatewayBalances(castAddr);
    let total = 0;
    tbody.innerHTML = balances.map(b => {
      total += parseFloat(b.balance);
      return `<tr><td>${b.domain}</td><td style="text-align:right;font-family:monospace">${b.balance}</td></tr>`;
    }).join("");
    tbody.innerHTML += `<tr style="border-top:2px solid #2a4a6b">
      <td><strong>TOTAL</strong></td>
      <td style="text-align:right;font-family:monospace;color:#81c784;font-weight:700">${total.toFixed(6)}</td>
    </tr>`;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="2" class="loading">Error: ${e.message}</td></tr>`;
  }
}

// --- MetaMask Connection ---

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask not found! Please install MetaMask.");
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    connectedAddress = accounts[0];
    const btn = document.getElementById("connectBtn");
    btn.textContent = shortAddr(connectedAddress);
    btn.classList.add("connected");

    // Populate from-wallet dropdown with connected address
    populateFromWallet();

    // Switch to Arc Testnet
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: ARC_CHAIN_ID,
            chainName: "Arc Testnet",
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC_RPC],
            blockExplorerUrls: ["https://testnet.arcscan.io"],
          }],
        });
      }
    }
  } catch (e) {
    alert("Connection failed: " + e.message);
  }
}

function populateFromWallet() {
  const select = document.getElementById("fromWallet");
  select.innerHTML = '<option value="">Select wallet...</option>';

  // Add connected wallet
  if (connectedAddress) {
    const opt = document.createElement("option");
    opt.value = connectedAddress;
    opt.textContent = `Connected: ${shortAddr(connectedAddress)}`;
    select.appendChild(opt);
    select.value = connectedAddress;
  }

  // Add known wallets for quick-fill of toAddress
  for (const w of WALLETS) {
    if (w.address.toLowerCase() !== (connectedAddress || "").toLowerCase()) {
      const opt = document.createElement("option");
      opt.value = w.address;
      opt.textContent = `${w.name}: ${shortAddr(w.address)}`;
      opt.disabled = true;
      select.appendChild(opt);
    }
  }

  // Pre-fill toAddress with a different wallet
  const otherWallet = WALLETS.find(
    w => w.address.toLowerCase() !== (connectedAddress || "").toLowerCase()
  );
  if (otherWallet) {
    document.getElementById("toAddress").value = otherWallet.address;
  }
}

// --- Transfer ---

async function doTransfer() {
  if (!connectedAddress) {
    alert("Please connect MetaMask first!");
    return;
  }

  const to = document.getElementById("toAddress").value.trim();
  const amountStr = document.getElementById("transferAmount").value.trim();
  const statusEl = document.getElementById("transferStatus");
  const btn = document.getElementById("transferBtn");

  if (!to || !amountStr) {
    statusEl.className = "error";
    statusEl.textContent = "Please fill in all fields.";
    statusEl.style.display = "block";
    return;
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    statusEl.className = "error";
    statusEl.textContent = "Invalid amount.";
    statusEl.style.display = "block";
    return;
  }

  // USDC has 6 decimals on Arc
  const rawAmount = BigInt(Math.round(amount * 1e6));
  const amountHex = rawAmount.toString(16).padStart(64, "0");
  const data = TRANSFER_SEL + padAddress(to) + amountHex;

  btn.disabled = true;
  statusEl.className = "pending";
  statusEl.textContent = `Sending ${amountStr} USDC to ${shortAddr(to)}...`;
  statusEl.style.display = "block";

  try {
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: connectedAddress,
        to: USDC_ARC,
        data: data,
        chainId: ARC_CHAIN_ID,
      }],
    });

    statusEl.className = "success";
    statusEl.innerHTML = `Transfer sent! TX: <a href="https://testnet.arcscan.io/tx/${txHash}" target="_blank" style="color:#81c784">${txHash.slice(0, 16)}...</a>`;

    transferHistory.unshift({
      from: connectedAddress,
      to: to,
      amount: amountStr,
      txHash: txHash,
      time: new Date().toLocaleTimeString(),
    });
    renderHistory();

    // Auto-refresh balances after 5s
    setTimeout(refreshBalances, 5000);
  } catch (e) {
    statusEl.className = "error";
    statusEl.textContent = "Transfer failed: " + (e.message || e);
  }

  btn.disabled = false;
}

// --- History ---

function renderHistory() {
  const el = document.getElementById("historyList");
  if (transferHistory.length === 0) {
    el.innerHTML = '<p class="muted">No transfers yet this session</p>';
    return;
  }
  el.innerHTML = transferHistory.map(h => `
    <div class="history-item">
      <div>
        <span class="amount">${h.amount} USDC</span>
        <span class="details"> to ${shortAddr(h.to)} at ${h.time}</span>
      </div>
      <a class="tx-hash" href="https://testnet.arcscan.io/tx/${h.txHash}" target="_blank">${h.txHash.slice(0, 16)}...</a>
    </div>
  `).join("");
}

function refreshHistory() {
  renderHistory();
}

// --- Init ---

window.addEventListener("DOMContentLoaded", () => {
  refreshBalances();
  refreshGateway();
});
