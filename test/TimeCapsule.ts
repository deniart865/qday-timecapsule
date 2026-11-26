import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, toBytes } from "viem";

describe("TimeCapsule", async () => {
  // Runs on Hardhat's simulated network; no QoreChain endpoint is needed.
  const { viem } = await network.create();

  const digest = keccak256(toBytes("hello from before q-day"));

  it("seals a digest and reads it back", async () => {
    const capsule = await viem.deployContract("TimeCapsule", []);
    const [wallet] = await viem.getWalletClients();

    await viem.assertions.emitWithArgs(
      capsule.write.seal([digest, "first capsule"]),
      capsule,
      "CapsuleSealed",
      [0n, wallet.account.address, digest, "first capsule"],
    );

    assert.equal(await capsule.read.capsuleCount(), 1n);
    const stored = (await capsule.read.getCapsule([0n])) as {
      sealer: string;
      digest: string;
      label: string;
      sealedAt: bigint;
      blockNumber: bigint;
    };
    assert.equal(stored.sealer.toLowerCase(), wallet.account.address.toLowerCase());
    assert.equal(stored.digest, digest);
    assert.equal(stored.label, "first capsule");
    assert.ok(stored.sealedAt > 0n);
  });

  it("verifies a matching digest and rejects a different one", async () => {
    const capsule = await viem.deployContract("TimeCapsule", []);
    await capsule.write.seal([digest, "verify me"]);

    assert.equal(await capsule.read.verify([0n, digest]), true);
    assert.equal(await capsule.read.verify([0n, keccak256(toBytes("tampered"))]), false);
    assert.equal(await capsule.read.verify([99n, digest]), false);
  });

  it("finds a capsule by digest", async () => {
    const capsule = await viem.deployContract("TimeCapsule", []);
    await capsule.write.seal([digest, "find me"]);

    const [found, id] = (await capsule.read.findByDigest([digest])) as [boolean, bigint];
    assert.equal(found, true);
    assert.equal(id, 0n);

    const [missing] = (await capsule.read.findByDigest([keccak256(toBytes("never sealed"))])) as [boolean, bigint];
    assert.equal(missing, false);
  });

  it("refuses to seal the same digest twice", async () => {
    const capsule = await viem.deployContract("TimeCapsule", []);
    await capsule.write.seal([digest, "once"]);
    await assert.rejects(capsule.write.seal([digest, "twice"]));
  });

  it("refuses the empty digest", async () => {
    const capsule = await viem.deployContract("TimeCapsule", []);
    await assert.rejects(
      capsule.write.seal(["0x0000000000000000000000000000000000000000000000000000000000000000", "empty"]),
    );
  });
});
