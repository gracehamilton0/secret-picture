const pseudoStorage = new Map<string, Uint8Array>();

function createPseudoCid(): string {
  const random = Math.random().toString(16).slice(2);
  const timestamp = Date.now().toString(16);
  let candidate = `pseudo-${timestamp}${random}`;
  while (pseudoStorage.has(candidate)) {
    candidate = `pseudo-${timestamp}${Math.random().toString(16).slice(2)}`;
  }
  return candidate;
}

export async function uploadToPseudoIpfs(payload: Uint8Array): Promise<string> {
  const cid = createPseudoCid();
  pseudoStorage.set(cid, new Uint8Array(payload));
  return cid;
}

export async function fetchFromIpfs(cid: string): Promise<Uint8Array> {
  const stored = pseudoStorage.get(cid);
  if (!stored) {
    throw new Error('Content is not available in pseudo IPFS storage');
  }
  return new Uint8Array(stored);
}
