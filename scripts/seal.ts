/**
 * seal.ts - seal a file (or a message) into the TimeCapsule contract on the
 * QoreChain testnet, then read the capsule back and verify it on chain.
 *
 * Usage:
 *   pnpm seal <path-to-file> [label]     seal the SHA-256 of a file
 *   pnpm seal --message "some text"      seal the SHA-256 of a message
 *
 * The contract address comes from CAPSULE_ADDRESS in .env, or from the
 * Ignition deployment record (ignition/deployments/chain-9800).
 *
 * Remember: on QoreChain every EVM transaction needs a live authorisation
 * window. If this fails with a window error, run `pnpm window open` first.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createPublicClient, createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://evm-testnet.qore.host";

const abi = parseAbi([
  "function seal(bytes32 digest, string label) returns (uint256)",
  "function getCapsule(uint256 id) view returns ((address sealer, bytes32 digest, string label, uint256 sealedAt, uint256 blockNumber))",
  "function capsuleCount() view returns (uint256)",
  "function verify(uint256 id, bytes32 digest) view returns (bool)",
  "event CapsuleSealed(uint256 indexed id, address indexed sealer, bytes32 indexed digest, string label)",
]);

function capsuleAddress(): Hex {
  const fromEnv = process.env.CAPSULE_ADDRESS?.trim();
  if (fromEnv) return fromEnv as Hex;
  const record = "ignition/deployments/chain-9800/deployed_addresses.json";
  if (existsSync(record)) {
    const addresses = JSON.parse(readFileSync(record, "utf8")) as Record<string, string>;
    const found = addresses["TimeCapsuleModule#TimeCapsule"];
    if (found) return found as Hex;
  }
  throw new Error("No capsule address: set CAPSULE_ADDRESS in .env or deploy first (pnpm deploy:testnet).");
}

function digestOf(): { digest: Hex; label: string } {
  const args = process.argv.slice(2);
  if (args[0] === "--message") {
    const text = args.slice(1).join(" ");
    if (!text) throw new Error('Usage: pnpm seal --message "some text"');
    return { digest: `0x${createHash("sha256").update(text).digest("hex")}` as Hex, label: `message: ${text.slice(0, 60)}` };
  }
  const path = args[0];
  if (!path) throw new Error("Usage: pnpm seal <path-to-file> [label]");
  const data = readFileSync(path);
  const label = args.slice(1).join(" ") || `file: ${path.split("/").pop()}`;
  return { digest: `0x${createHash("sha256").update(data).digest("hex")}` as Hex, label };
}

async function main() {
  const key = process.env.PRIVATE_KEY?.trim();
  if (!key) throw new Error("PRIVATE_KEY missing in .env");

  const account = privateKeyToAccount(key as Hex);
  const address = capsuleAddress();
  const { digest, label } = digestOf();

  const publicClient = createPublicClient({ transport: http(RPC) });
  const walletClient = createWalletClient({ account, transport: http(RPC) });

  console.log(`sealer:   ${account.address}`);
  console.log(`capsule:  ${address}`);
  console.log(`digest:   ${digest}`);
  console.log(`label:    ${label}`);

  const hash = await walletClient.writeContract({ address, abi, functionName: "seal", args: [digest, label], chain: null });
  console.log(`seal tx:  ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error("seal transaction reverted");

  const count = await publicClient.readContract({ address, abi, functionName: "capsuleCount" });
  const id = count - 1n;
  const capsule = await publicClient.readContract({ address, abi, functionName: "getCapsule", args: [id] });
  const ok = await publicClient.readContract({ address, abi, functionName: "verify", args: [id, digest] });

  console.log(`\nread back capsule #${id}:`);
  console.log(`  sealer:      ${capsule.sealer}`);
  console.log(`  digest:      ${capsule.digest}`);
  console.log(`  label:       ${capsule.label}`);
  console.log(`  sealed at:   ${new Date(Number(capsule.sealedAt) * 1000).toISOString()}`);
  console.log(`  block:       ${capsule.blockNumber}`);
  console.log(`  verify():    ${ok ? "MATCH - the capsule holds exactly this digest" : "MISMATCH"}`);
  console.log(`\nExplorer: https://explore.qore.network (switch to Testnet, search ${hash})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
