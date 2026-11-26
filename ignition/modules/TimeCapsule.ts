import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Deploys TimeCapsule. On QoreChain the deployer needs a registered ML-DSA-87
 * key and a live EVM authorisation window first (see README: pnpm window open).
 */
export default buildModule("TimeCapsuleModule", (m) => {
  const timeCapsule = m.contract("TimeCapsule", []);
  return { timeCapsule };
});
