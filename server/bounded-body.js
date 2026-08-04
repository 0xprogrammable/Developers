const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

function declaredLength(response) {
  const value = response.headers.get("content-length");
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function readBoundedBytes(response, maximumBytes, label = "response") {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) {
    throw new Error("maximum response size must be a positive safe integer");
  }

  const advertised = declaredLength(response);
  if (advertised !== null && advertised > maximumBytes) {
    throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => {});
        throw new Error(`${label} exceeds the ${maximumBytes}-byte limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readBoundedText(response, maximumBytes, label = "response") {
  return UTF8_DECODER.decode(
    await readBoundedBytes(response, maximumBytes, label),
  );
}

export async function readBoundedJson(response, maximumBytes, label = "response") {
  return JSON.parse(await readBoundedText(response, maximumBytes, label));
}
