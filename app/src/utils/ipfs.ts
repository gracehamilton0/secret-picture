const WEB3_STORAGE_UPLOAD_URL = 'https://api.web3.storage/upload';
const IPFS_GATEWAYS = ['https://w3s.link/ipfs/', 'https://ipfs.io/ipfs/'];

export async function uploadToWeb3Storage(token: string, payload: Blob): Promise<string> {
  if (!token) {
    throw new Error('Web3.Storage token is required');
  }

  const response = await fetch(WEB3_STORAGE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: payload,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`IPFS upload failed (${response.status}): ${body}`);
  }

  const result = await response.json();
  const cid = result.cid || result.value?.cid;
  if (!cid) {
    throw new Error('Unexpected response from Web3.Storage');
  }
  return cid as string;
}

export function buildIpfsGatewayUrl(cid: string): string {
  return `${IPFS_GATEWAYS[0]}${cid}`;
}

export async function fetchFromIpfs(cid: string): Promise<Uint8Array> {
  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}${cid}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        return new Uint8Array(buffer);
      }
    } catch (error) {
      console.warn(`Failed to fetch from ${gateway}`, error);
    }
  }
  throw new Error('Unable to retrieve IPFS content from public gateways');
}
