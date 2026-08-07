const ADDRESS = /^0x[0-9a-f]{40}$/;
const UINT256_MAX = (1n << 256n) - 1n;
const UINT64_MASK = (1n << 64n) - 1n;
const KECCAK_RATE_BYTES = 136;

const KECCAK_ROUND_CONSTANTS = Object.freeze([
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]);

const KECCAK_ROTATIONS = Object.freeze([
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
]);

export function keccak256(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError("keccak256 input must be bytes");
  const paddedLength = Math.ceil((input.byteLength + 1) / KECCAK_RATE_BYTES) * KECCAK_RATE_BYTES;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.byteLength] = 0x01;
  padded[padded.length - 1] |= 0x80;
  const state = Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += KECCAK_RATE_BYTES) {
    for (let lane = 0; lane < KECCAK_RATE_BYTES / 8; lane += 1) {
      state[lane] ^= littleEndianLane(padded, offset + lane * 8);
    }
    keccakPermutation(state);
  }
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number((state[Math.floor(index / 8)] >> BigInt((index % 8) * 8)) & 0xffn);
  }
  return `0x${Buffer.from(output).toString("hex")}`;
}

export function deriveUniswapV4PoolId({ currency0, currency1, feeRaw, tickSpacing, hooks }) {
  const words = [
    addressWord(currency0),
    addressWord(currency1),
    uintWord(BigInt(feeRaw)),
    uintWord(BigInt.asUintN(256, BigInt(tickSpacing))),
    addressWord(hooks),
  ];
  const encoded = new Uint8Array(words.length * 32);
  words.forEach((word, index) => encoded.set(word, index * 32));
  return keccak256(encoded);
}

function addressWord(value) {
  if (!ADDRESS.test(value)) throw new TypeError("EVM address is not canonical");
  return Uint8Array.from(Buffer.from(value.slice(2).padStart(64, "0"), "hex"));
}

function uintWord(value) {
  if (value < 0n || value > UINT256_MAX) throw new TypeError("ABI uint256 is outside range");
  return Uint8Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
}

function littleEndianLane(bytes, offset) {
  let lane = 0n;
  for (let index = 0; index < 8; index += 1) {
    lane |= BigInt(bytes[offset + index]) << BigInt(index * 8);
  }
  return lane;
}

function rotateLeft64(value, shift) {
  if (shift === 0) return value & UINT64_MASK;
  const width = BigInt(shift);
  return ((value << width) | (value >> (64n - width))) & UINT64_MASK;
}

function keccakPermutation(state) {
  for (const roundConstant of KECCAK_ROUND_CONSTANTS) {
    const columns = Array(5).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) columns[x] ^= state[x + y * 5];
    }
    const deltas = columns.map((_, x) =>
      columns[(x + 4) % 5] ^ rotateLeft64(columns[(x + 1) % 5], 1));
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) state[x + y * 5] ^= deltas[x];
    }

    const rotated = Array(25).fill(0n);
    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        rotated[y + ((2 * x + 3 * y) % 5) * 5] =
          rotateLeft64(state[x + y * 5], KECCAK_ROTATIONS[x + y * 5]);
      }
    }

    for (let x = 0; x < 5; x += 1) {
      for (let y = 0; y < 5; y += 1) {
        state[x + y * 5] = (
          rotated[x + y * 5] ^
          ((~rotated[((x + 1) % 5) + y * 5]) & rotated[((x + 2) % 5) + y * 5])
        ) & UINT64_MASK;
      }
    }
    state[0] ^= roundConstant;
  }
}
