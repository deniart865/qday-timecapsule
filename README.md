# Q-Day Time Capsule

A proof-of-existence notary on [QoreChain](https://qorechain.io): seal the SHA-256 hash of any file or message on chain, then read it back later to prove the content existed, unchanged, at a given time.

Built for **Build Before Q-Day: The QoreChain Developer Fest** — **Quantum Pass** level. The Quantum Pass ask is "a small app that sends a hybrid post-quantum transaction and reads it back from the chain", and that is exactly the flow here:

1. Register the account's ML-DSA-87 key once (`pnpm window register`).
2. Open an EVM authorisation window with a **hybrid-signed transaction** (secp256k1 + ML-DSA-87) — `pnpm window open`. The validators verify both signatures and emit a `pqc_hybrid_verify` event with status `verified`.
3. Inside that window, deploy `TimeCapsule` and seal a digest (`pnpm seal`).
4. Read the capsule back from the chain and verify it (`verify()`), and independently prove the hybrid signature from the public REST endpoint (`pnpm verify:hybrid`).

Every capsule is therefore anchored by a post-quantum signature the chain itself checked — a timestamp that stays trustworthy even after Q-Day.

## The contract

`contracts/TimeCapsule.sol` (Solidity, MIT):

- `seal(bytes32 digest, string label)` — seal a digest once (first sealer wins), emits `CapsuleSealed`.
- `getCapsule(id)` — read a capsule back (sealer, digest, label, timestamp, block).
- `verify(id, digest)` — does capsule `id` hold exactly this digest?
- `findByDigest(digest)` — was this digest ever sealed, and as which capsule?
- `capsuleCount()` — total capsules sealed.

## Run it (testnet)

Prerequisites: Node.js 22+, pnpm.

```sh
pnpm install
cp .env.example .env   # the scaffolder already did this
```

Create a **throwaway testnet account** (never use a wallet with real funds):

```sh
node make-key.mjs            # writes a fresh PRIVATE_KEY into .env
pnpm window recovery-code    # prints a QRC1... code; paste it into .env as QORE_PQC_RECOVERY_CODE
pnpm window status           # shows your 0x... and qor1... addresses
```

Get test QOR from the [faucet](https://dashboard.qorechain.io/faucet) (sign in, Testnet, paste the `qor1...` address — 100 QOR per 24 hours), then:

```sh
pnpm window register         # one-time ML-DSA-87 key registration (~0.09 QOR)
pnpm window open             # hybrid-signed window; note the `opened:` hash
pnpm build && pnpm test
pnpm deploy:testnet          # deploys TimeCapsule inside the window
pnpm seal README.md "the project readme, sealed before q-day"
pnpm seal --message "hello from before q-day"
pnpm verify:hybrid <opened-hash>   # prints the on-chain hybrid verification proof
```

Verify any transaction in the [explorer](https://explore.qore.network) (switch to Testnet) or from the REST endpoint `https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/<hash>`: look for `code: 0`, the `PQCHybridSignature` extension (4,627-byte ML-DSA-87 signature) and the `pqc_hybrid_verify` event with status `verified`.

## Networks

| Network | EVM chain id | Hardhat network | RPC |
| --- | --- | --- | --- |
| Testnet (`qorechain-diana`) | 9800 | `qorechainTestnet` | `https://evm-testnet.qore.host` |
| Mainnet (`qorechain-vladi`) | 9801 | `qorechain` | `https://evm.qore.host` |

This project runs on the **testnet** only.

## Testnet addresses

- Deployer / sealer account: `0x6F6855e360Db5E25C282948728D69C4f546fDeF4` (`qor1da59tcmqmd0zts5zjjrj345ufa2xlhh54v6sxk`)
- TimeCapsule contract: _deployed during the fest demo — see the submission page_

## Credits

Scaffolded with the official QoreChain Hardhat template (`create-qorechain-dapp`), using `@qorechain/sdk` and `@qorechain/evm` for the hybrid-signing window flow, Hardhat 3 and viem. The `TimeCapsule` contract, tests, and the `seal` / `verify-hybrid` scripts are original work for this fest. The template's example `Counter` contract is kept for reference.

## Licence

MIT — see [LICENSE](LICENSE).
