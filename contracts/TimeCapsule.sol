// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TimeCapsule
/// @notice A proof-of-existence notary for QoreChain: seal the SHA-256 hash of
///         any file or message on chain, then read it back later to prove the
///         content existed, unchanged, at a given time.
///
///         Built for Build Before Q-Day (Quantum Pass). On QoreChain the seal
///         transaction is an ordinary EVM transaction admitted inside an EVM
///         authorisation window that was opened by a hybrid-signed
///         (secp256k1 + ML-DSA-87) transaction, so every capsule is anchored
///         by a post-quantum signature the validators verified on chain.
contract TimeCapsule {
    struct Capsule {
        address sealer;
        bytes32 digest;
        string label;
        uint256 sealedAt; // block timestamp when the capsule was sealed
        uint256 blockNumber; // block the seal landed in
    }

    /// @notice All sealed capsules, in seal order. The index is the capsule id.
    Capsule[] public capsules;

    /// @notice digest -> capsule id + 1 (0 means the digest was never sealed).
    mapping(bytes32 => uint256) public capsuleIdByDigest;

    /// @notice Emitted when a capsule is sealed.
    event CapsuleSealed(uint256 indexed id, address indexed sealer, bytes32 indexed digest, string label);

    error EmptyDigest();
    error AlreadySealed(bytes32 digest, uint256 id);

    /// @notice Seal a digest on chain. Each digest can be sealed only once;
    ///         the first sealer is the one on record.
    /// @param digest SHA-256 (or any 32-byte) hash of the content being sealed.
    /// @param label Short human-readable note about what was sealed.
    /// @return id The id of the new capsule.
    function seal(bytes32 digest, string calldata label) external returns (uint256 id) {
        if (digest == bytes32(0)) revert EmptyDigest();
        uint256 existing = capsuleIdByDigest[digest];
        if (existing != 0) revert AlreadySealed(digest, existing - 1);

        id = capsules.length;
        capsules.push(
            Capsule({sealer: msg.sender, digest: digest, label: label, sealedAt: block.timestamp, blockNumber: block.number})
        );
        capsuleIdByDigest[digest] = id + 1;
        emit CapsuleSealed(id, msg.sender, digest, label);
    }

    /// @notice How many capsules have been sealed.
    function capsuleCount() external view returns (uint256) {
        return capsules.length;
    }

    /// @notice Read one capsule back from the chain.
    function getCapsule(uint256 id) external view returns (Capsule memory) {
        return capsules[id];
    }

    /// @notice Check that capsule `id` holds exactly `digest`.
    function verify(uint256 id, bytes32 digest) external view returns (bool) {
        return id < capsules.length && capsules[id].digest == digest;
    }

    /// @notice Look a digest up: was it sealed, and as which capsule?
    function findByDigest(bytes32 digest) external view returns (bool found, uint256 id) {
        uint256 stored = capsuleIdByDigest[digest];
        return stored == 0 ? (false, 0) : (true, stored - 1);
    }
}
