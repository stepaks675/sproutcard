import { NextResponse } from "next/server";

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2";
const DEFAULT_CHAINS = [
  "eth",
  "bsc",
  "arbitrum",
  "base",
  "optimism",
  "linea",
];

function isValidEvmAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function extractSwapsFromResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.swaps)) return data.swaps;
  return [];
}

function getNextCursor(data) {
  return (
    (data && (data.cursor || data.next_cursor || data.nextCursor)) ||
    (data && data.pagination && (data.pagination.cursor || data.pagination.next_cursor)) ||
    null
  );
}

function simplifySwapItem(item) {
  const simplified = {
    transactionType: item?.transactionType ?? null,
    baseQuotePrice: item?.baseQuotePrice ?? null,
    blockTimestamp: item?.blockTimestamp ?? null,
    pairLabel: item?.pairLabel ?? null,
    totalValueUsd: item?.totalValueUsd ?? null,
    boughtAmount: Number.isFinite(Number(item?.bought?.amount))
      ? Number(item.bought.amount)
      : null,
    boughtUsdAmount: Number.isFinite(Number(item?.bought?.usdAmount))
      ? Number(item.bought.usdAmount)
      : null,
    soldAmount: Number.isFinite(Number(item?.sold?.amount))
      ? Number(item.sold.amount)
      : null,
    soldUsdAmount: Number.isFinite(Number(item?.sold?.usdAmount))
      ? Number(item.sold.usdAmount)
      : null,
  };

  return simplified;
}

function getBaseTokenSymbol(pairLabel) {
  if (typeof pairLabel !== "string" || !pairLabel.length) return null;
  const baseRaw = (pairLabel.split("/")[0] || "").trim();
  if (!baseRaw) return null;
  if (baseRaw.length > 1 && (baseRaw[0] === "W" || baseRaw[0] === "w")) {
    return baseRaw.slice(1);
  }
  return baseRaw;
}

function normalizeTokenSymbol(symbol) {
  if (typeof symbol !== "string" || !symbol.length) return null;
  const s = symbol.trim();
  if (!s) return null;
  if (s.length > 1 && (s[0] === "W" || s[0] === "w")) return s.slice(1);
  return s;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const address = (body.address || "").trim();
    const inputChains = Array.isArray(body.chains) ? body.chains : undefined;
    const chains = (inputChains || DEFAULT_CHAINS)
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter((c) => DEFAULT_CHAINS.includes(c));
    const limit = Number.isFinite(body?.limit)
      ? Math.max(1, Math.min(100, Math.trunc(body.limit)))
      : 100;

    if (!process.env.MORALIS_API_KEY) {
      return NextResponse.json(
        { error: "Server not configured: missing MORALIS_API_KEY" },
        { status: 500 }
      );
    }

    if (!address || !isValidEvmAddress(address)) {
      return NextResponse.json(
        { error: "Invalid or missing EVM address" },
        { status: 400 }
      );
    }

    const resultsByChain = {};
    const errors = [];

    for (const chain of chains) {
      let cursor = null;
      let combined = [];
      let pageCount = 0;
      let lastStatus = 200;

      while (true) {
        const url = new URL(`${MORALIS_BASE}/wallets/${address}/swaps`);
        url.searchParams.set("chain", chain);
        if (limit) url.searchParams.set("limit", String(limit));
        if (cursor) url.searchParams.set("cursor", cursor);

        try {
          const moralisResponse = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "x-api-key": process.env.MORALIS_API_KEY,
              accept: "application/json",
            },
            next: { revalidate: 0 },
          });

          lastStatus = moralisResponse.status;
          const data = await moralisResponse
            .json()
            .catch(() => ({ error: "Invalid JSON from Moralis" }));

          if (!moralisResponse.ok) {
            errors.push({ chain, status: moralisResponse.status, details: data });
            break;
          }

          const items = extractSwapsFromResponse(data);
          if (items.length) combined = combined.concat(items);

          const nextCursor = getNextCursor(data);
          pageCount += 1;

          if (!nextCursor || nextCursor === cursor) {
            break;
          }
          cursor = nextCursor;

          // Safety to avoid infinite loops
          if (pageCount > 1000) break;
        } catch (err) {
          errors.push({ chain, status: 0, details: { error: "Network error" } });
          break;
        }
      }

      const simplified = combined.map((rawItem) => {
        const base = simplifySwapItem(rawItem);
        const boughtAddress =
          typeof rawItem?.bought?.address === "string" ? rawItem.bought.address : null;
        const soldAddress =
          typeof rawItem?.sold?.address === "string" ? rawItem.sold.address : null;
        return {
          ...base,
          chain,
          boughtAddress,
          soldAddress,
        };
      });
      resultsByChain[chain] = {
        items: simplified,
        count: simplified.length,
        pages: pageCount,
        lastStatus,
      };
    }

    // Flatten and sort by blockTimestamp (oldest first)
    const combined = chains
      .flatMap((c) => (resultsByChain[c]?.items || []))
      .slice()
      .sort((a, b) => {
        const ta = typeof a.blockTimestamp === "string" ? a.blockTimestamp : "";
        const tb = typeof b.blockTimestamp === "string" ? b.blockTimestamp : "";
        return ta.localeCompare(tb);
      });

    // Compute holdings and PNL from oldest to newest
    const holdings = Object.create(null);
    const holdingsByTokenKey = Object.create(null); // key: `${chain}:${address.toLowerCase()}` -> amount
    const tokenKeyMeta = Object.create(null); // tokenKey -> { symbol, chain, address }
    const positionCostUsdBySymbol = Object.create(null); // symbol -> running cost basis USD for current position
    let realizedPnlUsd = 0;
    let pnl = 0;
    let minPnlDuringCalc = 0;

    for (const item of combined) {
      const type = String(item?.transactionType || "").toLowerCase();
      const symbol = getBaseTokenSymbol(item?.pairLabel);
      if (!symbol) continue;

      if (type === "buy") {
        const quantity = Math.abs(Number(item?.boughtAmount));
        const usdUsed = Math.abs(Number(item?.boughtUsdAmount));
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(usdUsed) || usdUsed <= 0) continue;
        holdings[symbol] = (holdings[symbol] || 0) + quantity;
        pnl -= usdUsed;
        if (pnl < minPnlDuringCalc) minPnlDuringCalc = pnl;
        // Track cost basis for average-cost method
        positionCostUsdBySymbol[symbol] = (positionCostUsdBySymbol[symbol] || 0) + usdUsed;
        const chain = typeof item?.chain === "string" ? item.chain : null;
        const address = typeof item?.boughtAddress === "string" ? item.boughtAddress : null;
        if (chain && address) {
          const key = `${chain}:${address.toLowerCase()}`;
          holdingsByTokenKey[key] = (holdingsByTokenKey[key] || 0) + quantity;
          if (!tokenKeyMeta[key]) tokenKeyMeta[key] = { symbol, chain, address };
        }
      } else if (type === "sell") {
        const quantity = Math.abs(Number(item?.soldAmount));
        const usdUsed = Math.abs(Number(item?.soldUsdAmount));
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(usdUsed) || usdUsed <= 0) continue;
        const available = holdings[symbol] || 0;
        if (available <= 0) continue;
        const sellQuantity = Math.min(available, quantity);
        const realizedUsd = usdUsed * (sellQuantity / quantity);
        // Compute realized PnL using average cost basis prior to updating position
        const posCostBefore = positionCostUsdBySymbol[symbol] || 0;
        if (available > 0 && sellQuantity > 0 && posCostBefore > 0) {
          const avgCostPerUnit = posCostBefore / available;
          const realizedCostUsd = avgCostPerUnit * sellQuantity;
          realizedPnlUsd += realizedUsd - realizedCostUsd;
          // Reduce cost basis
          positionCostUsdBySymbol[symbol] = Math.max(0, posCostBefore - realizedCostUsd);
        }
        holdings[symbol] = available - sellQuantity;
        pnl += realizedUsd;
        if (pnl < minPnlDuringCalc) minPnlDuringCalc = pnl;
        const chain = typeof item?.chain === "string" ? item.chain : null;
        const address = typeof item?.soldAddress === "string" ? item.soldAddress : null;
        if (chain && address) {
          const key = `${chain}:${address.toLowerCase()}`;
          const current = holdingsByTokenKey[key] || 0;
          const tokenSellQty = Math.min(current, sellQuantity);
          holdingsByTokenKey[key] = Math.max(0, current - tokenSellQty);
          if (!tokenKeyMeta[key]) tokenKeyMeta[key] = { symbol, chain, address };
        }
      }
    }

    // For each token, pick only 1 network: choose the chain-address pair with the largest amount
    const chosenPerSymbol = Object.create(null); // symbol -> { chain, address, amount }
    for (const [key, amount] of Object.entries(holdingsByTokenKey)) {
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const meta = tokenKeyMeta[key];
      if (!meta || !meta.symbol) continue;
      const symbol = meta.symbol;
      if (!Number.isFinite(holdings[symbol]) || holdings[symbol] <= 0) continue;
      const current = chosenPerSymbol[symbol];
      if (!current || amount > current.amount) {
        chosenPerSymbol[symbol] = { chain: meta.chain, address: meta.address, amount };
      }
    }

    // Group chosen tokens by chain to price them
    const tokensByChain = Object.create(null); // chain -> [{ token_address }]
    const amountByChainAndAddress = Object.create(null); // `${chain}:${address}` -> amount
    for (const [symbol, sel] of Object.entries(chosenPerSymbol)) {
      if (!sel || !sel.chain || !sel.address || !Number.isFinite(sel.amount) || sel.amount <= 0) continue;
      if (!tokensByChain[sel.chain]) tokensByChain[sel.chain] = [];
      tokensByChain[sel.chain].push({ token_address: sel.address });
      amountByChainAndAddress[`${sel.chain}:${sel.address.toLowerCase()}`] = sel.amount;
    }

    // Fetch prices per chain and add current value to pnl
    let holdingsValueUsd = 0;
    for (const chain of Object.keys(tokensByChain)) {
      const url = new URL(`${MORALIS_BASE}/erc20/prices`);
      url.searchParams.set("chain", chain);
      try {
        const resp = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "x-api-key": process.env.MORALIS_API_KEY,
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ tokens: tokensByChain[chain] }),
          next: { revalidate: 0 },
        });
        const data = await resp.json().catch(() => []);
        const priceItems = Array.isArray(data) ? data : Array.isArray(data.result) ? data.result : [];
        for (const p of priceItems) {
          const address = typeof p?.tokenAddress === "string" ? p.tokenAddress : null;
          const usdPrice = Number(p?.usdPrice);
          if (!address || !Number.isFinite(usdPrice)) continue;
          const amount = amountByChainAndAddress[`${chain}:${address.toLowerCase()}`];
          if (!Number.isFinite(amount) || amount <= 0) continue;
          const valueUsd = amount * usdPrice;
          holdingsValueUsd += valueUsd;
          
        }
      } catch (err) {
        // ignore network errors per chain
      }
    }
    // Filter holdings to exclude zeros
    const filteredHoldings = Object.create(null);
    for (const [symbol, amount] of Object.entries(holdings)) {
      if (Number.isFinite(amount) && amount > 0) filteredHoldings[symbol] = amount;
    }

    // Compute unrealized PnL = current total value - remaining cost basis across open positions
    let remainingCostUsdTotal = 0;
    for (const [symbol, amount] of Object.entries(filteredHoldings)) {
      const remainingCost = Number(positionCostUsdBySymbol[symbol]) || 0;
      remainingCostUsdTotal += remainingCost;
    }
    const unrealizedPnlUsd = holdingsValueUsd - remainingCostUsdTotal;

    // Total PnL
    pnl = realizedPnlUsd + unrealizedPnlUsd;
    const investedUsd = Math.abs(minPnlDuringCalc);

    return NextResponse.json({ pnl, realizedPnlUsd, unrealizedPnlUsd, investedUsd, holdings: filteredHoldings, holdingsValueUsd }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}


