/**
 * verify-hybrid.ts - prove on chain that a transaction was hybrid-signed.
 *
 * Fetches the transaction record from the public testnet REST endpoint and
 * prints the PQCHybridSignature extension size plus the pqc_hybrid_verify
 * event the validators emitted.
 *
 * Usage:
 *   pnpm verify:hybrid <tx-hash>     (use the `opened:` hash from pnpm window open)
 */
const REST = "https://api-testnet.qore.host";

async function main() {
  const hash = process.argv[2]?.replace(/^0x/, "");
  if (!hash) throw new Error("Usage: pnpm verify:hybrid <tx-hash>");

  const res = await fetch(`${REST}/cosmos/tx/v1beta1/txs/${hash}`);
  if (!res.ok) throw new Error(`REST returned HTTP ${res.status} (tx may not be final yet - wait ~10s and retry)`);
  const body = (await res.json()) as {
    tx?: { body?: { extension_options?: Array<{ "@type"?: string; signature?: string }> } };
    tx_response?: { code?: number; events?: Array<{ type: string; attributes?: Array<{ key: string; value: string }> }> };
  };

  const code = body.tx_response?.code;
  console.log(`tx code:        ${code} ${code === 0 ? "(success)" : "(FAILED)"}`);

  const ext = body.tx?.body?.extension_options?.find((o) => (o["@type"] ?? "").includes("PQCHybridSignature"));
  if (ext?.signature) {
    const bytes = Buffer.from(ext.signature, "base64").length;
    console.log(`hybrid ext:     PQCHybridSignature present, ML-DSA-87 signature ${bytes} bytes (secp256k1 is 64)`);
  } else {
    console.log("hybrid ext:     NOT FOUND - this transaction was not hybrid-signed");
  }

  const event = body.tx_response?.events?.find((e) => e.type === "pqc_hybrid_verify");
  if (event) {
    const status = event.attributes?.find((a) => a.key === "status")?.value;
    console.log(`pqc_hybrid_verify event: status = ${status}`);
    console.log(status === "verified" ? "\nPROOF: the validators verified BOTH signatures on chain." : "\nThe hybrid verification did not pass.");
  } else {
    console.log("pqc_hybrid_verify event: NOT FOUND");
  }

  console.log(`\nExplorer: https://explore.qore.network (switch to Testnet, search ${hash})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
