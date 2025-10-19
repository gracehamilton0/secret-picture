import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Contract, Wallet, ethers } from 'ethers';

import { Header } from './Header';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { decryptContent, detectMimeType, encryptContent } from '../utils/crypto';
import { fetchFromIpfs, uploadToPseudoIpfs } from '../utils/ipfs';
import '../styles/GalleryApp.css';

type PreparedEncryption = {
  walletAddress: string;
  privateKeyHex: string;
  keyBigInt: bigint;
  payload: Uint8Array;
  mimeType: string;
  fileName: string;
};

type GalleryItem = {
  id: bigint;
  creator: string;
  ipfsHash: string;
  price: bigint;
  createdAt: bigint;
  encryptedKey: string;
  hasAccess: boolean;
  purchasing: boolean;
  decrypting: boolean;
  decryptedImageUrl?: string;
  decryptedKeyHex?: string;
};

const ACCESS_DURATION_DAYS = '10';

export function GalleryApp() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedEncryption | null>(null);
  const [encrypting, setEncrypting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ipfsHash, setIpfsHash] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [price, setPrice] = useState<bigint | null>(null);
  const decryptedUrlRef = useRef<Map<bigint, string>>(new Map());
  const [fetchNonce, setFetchNonce] = useState(0);

  const contractAddress = CONTRACT_ADDRESS;
  const contractConfigReady = useMemo(() => /^0x[a-fA-F0-9]{40}$/.test(contractAddress), [contractAddress]);

  useEffect(() => {
    return () => {
      decryptedUrlRef.current.forEach((url) => URL.revokeObjectURL(url));
      decryptedUrlRef.current.clear();
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetEncryptionState = useCallback(() => {
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setPrepared(null);
    setIpfsHash('');
  }, [filePreviewUrl]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setSelectedFile(file);
    setFilePreviewUrl(preview);
    setPrepared(null);
    setIpfsHash('');
  }, [filePreviewUrl]);

  const handleEncrypt = useCallback(async () => {
    if (!selectedFile) {
      alert('Select an image before encrypting');
      return;
    }
    setEncrypting(true);
    try {
      const wallet = Wallet.createRandom();
      const buffer = await selectedFile.arrayBuffer();
      const payload = await encryptContent(buffer, wallet.privateKey);
      const preparedEncryption: PreparedEncryption = {
        walletAddress: wallet.address,
        privateKeyHex: wallet.privateKey,
        keyBigInt: BigInt(wallet.privateKey),
        payload,
        mimeType: selectedFile.type || 'application/octet-stream',
        fileName: selectedFile.name,
      };
      setPrepared(preparedEncryption);
    } catch (error) {
      console.error('Encryption failed', error);
      alert(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEncrypting(false);
    }
  }, [selectedFile]);

  const handleUpload = useCallback(async () => {
    if (!prepared) {
      alert('Encrypt the image before uploading');
      return;
    }
    setUploading(true);
    try {
      const cid = await uploadToPseudoIpfs(prepared.payload);
      setIpfsHash(cid);
    } catch (error) {
      console.error('Pseudo upload failed', error);
      alert(`Pseudo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, [prepared]);

  const handlePublish = useCallback(async () => {
    if (!prepared || !ipfsHash) {
      alert('Encrypt and upload the image before publishing on-chain');
      return;
    }
    if (!instance || !address) {
      alert('Connect wallet and wait for encryption service to load');
      return;
    }
    if (!signerPromise) {
      alert('Wallet signer unavailable');
      return;
    }
    setPublishing(true);
    try {
      const encryptedInput = await instance
        .createEncryptedInput(contractAddress, address)
        .add256(prepared.keyBigInt)
        .encrypt();

      const signer = await signerPromise;
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.listEncryptedImage(ipfsHash, encryptedInput.handles[0], encryptedInput.inputProof);
      await tx.wait();

      resetEncryptionState();
      setFetchNonce((value) => value + 1);
    } catch (error) {
      console.error('Publish failed', error);
      alert(`Publish failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
    }
  }, [prepared, ipfsHash, instance, address, signerPromise, resetEncryptionState, contractAddress]);

  const fetchGallery = useCallback(async () => {
    if (!contractConfigReady || !publicClient) {
      return;
    }
    setRefreshing(true);
    try {
      const totalImages = (await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'getTotalImages',
      })) as bigint;

      const rawPrice = (await publicClient.readContract({
        address: contractAddress,
        abi: CONTRACT_ABI,
        functionName: 'ACCESS_PRICE',
      })) as bigint;
      setPrice(rawPrice);

      const ids = Array.from({ length: Number(totalImages) }, (_, index) => BigInt(index + 1));
      const fetched: GalleryItem[] = await Promise.all(
        ids.map(async (id) => {
          const [creator, hash, priceValue, createdAt, encryptedKey] = (await publicClient.readContract({
            address: contractAddress,
            abi: CONTRACT_ABI,
            functionName: 'getImage',
            args: [id],
          })) as [string, string, bigint, bigint, string];

          let hasAccess = false;
          if (isConnected && address) {
            try {
              hasAccess = (await publicClient.readContract({
                address: contractAddress,
                abi: CONTRACT_ABI,
                functionName: 'hasPurchased',
                args: [id, address],
              })) as boolean;
            } catch (error) {
              console.warn('Unable to read access state', error);
            }
            if (creator.toLowerCase() === address.toLowerCase()) {
              hasAccess = true;
            }
          }

          return {
            id,
            creator,
            ipfsHash: hash,
            price: priceValue,
            createdAt,
            encryptedKey,
            hasAccess,
            purchasing: false,
            decrypting: false,
          } as GalleryItem;
        }),
      );

      setItems(fetched.sort((a, b) => Number(b.id - a.id)));
    } catch (error) {
      console.error('Failed to fetch gallery', error);
    } finally {
      setRefreshing(false);
    }
  }, [address, contractAddress, contractConfigReady, isConnected, publicClient]);

  useEffect(() => {
    if (contractConfigReady) {
      fetchGallery();
    }
  }, [contractConfigReady, fetchGallery, fetchNonce]);

  const handlePurchase = useCallback(
    async (item: GalleryItem) => {
      if (!signerPromise) {
        alert('Connect your wallet to purchase access');
        return;
      }
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                purchasing: true,
              }
            : entry,
        ),
      );
      try {
        const signer = await signerPromise;
        const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
        const accessPrice = await contract.ACCESS_PRICE();
        const tx = await contract.purchaseImage(item.id, { value: accessPrice });
        await tx.wait();
        setFetchNonce((value) => value + 1);
      } catch (error) {
        console.error('Purchase failed', error);
        alert(`Purchase failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  purchasing: false,
                }
              : entry,
          ),
        );
      }
    },
    [contractAddress, signerPromise],
  );

  const handleDecrypt = useCallback(
    async (item: GalleryItem) => {
      if (!instance || !address || !signerPromise) {
        alert('Connect your wallet and wait for encryption service to load');
        return;
      }
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                decrypting: true,
              }
            : entry,
        ),
      );

      try {
        const keypair = instance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const contracts = [contractAddress];
        const handles = [{ handle: item.encryptedKey, contractAddress }];
        const eip712 = instance.createEIP712(keypair.publicKey, contracts, startTimestamp, ACCESS_DURATION_DAYS);
        const signer = await signerPromise;
        const signature = await signer.signTypedData(
          eip712.domain,
          { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          eip712.message,
        );

        const decryptedMap = await instance.userDecrypt(
          handles,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contracts,
          address,
          startTimestamp,
          ACCESS_DURATION_DAYS,
        );

        const decryptedValue = decryptedMap[item.encryptedKey as keyof typeof decryptedMap];
        if (!decryptedValue) {
          throw new Error('Decryption result missing');
        }
        const keyBigInt = BigInt(decryptedValue as string);
        const keyHex = `0x${keyBigInt.toString(16).padStart(64, '0')}`;

        const encryptedBytes = await fetchFromIpfs(item.ipfsHash);
        const decryptedBytes = await decryptContent(encryptedBytes, keyHex);
        const mime = detectMimeType(decryptedBytes);
        const blob = new Blob([decryptedBytes], { type: mime });
        const url = URL.createObjectURL(blob);

        const previousUrl = decryptedUrlRef.current.get(item.id);
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        decryptedUrlRef.current.set(item.id, url);

        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  decrypting: false,
                  decryptedImageUrl: url,
                  decryptedKeyHex: keyHex,
                }
              : entry,
          ),
        );
      } catch (error) {
        console.error('Decrypt failed', error);
        alert(`Decrypt failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  decrypting: false,
                }
              : entry,
          ),
        );
      }
    },
    [address, contractAddress, instance, signerPromise],
  );

  const priceLabel = useMemo(() => {
    if (!price) {
      return '0.001 ETH';
    }
    return `${ethers.formatEther(price)} ETH`;
  }, [price]);

  if (!contractConfigReady) {
    return (
      <div className="gallery-wrapper">
        <Header onRefresh={() => undefined} refreshing={false} />
        <div className="warning-card">
          <h2>Contract address missing</h2>
          <p>
            Set <code>VITE_ENCRYPTED_GALLERY_ADDRESS</code> in your environment before running the frontend so it can
            connect to the deployed contract on Sepolia.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gallery-wrapper">
      <Header onRefresh={fetchGallery} refreshing={refreshing} />

      <main className="main-layout">
        <section className="card">
          <h2 className="card-title">Create Encrypted Listing</h2>
          <p className="card-subtitle">
            Select an image, encrypt it locally with a freshly generated wallet key, simulate uploading the ciphertext,
            and store the fully homomorphic encrypted key on-chain.
          </p>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Select image</span>
              <input type="file" accept="image/*" onChange={handleFileChange} />
            </label>

            {filePreviewUrl ? (
              <div className="preview-box">
                <img src={filePreviewUrl} alt="Selected" />
                <span className="preview-caption">Local preview (never uploaded)</span>
              </div>
            ) : null}

            <button className="primary-button" onClick={handleEncrypt} disabled={!selectedFile || encrypting}>
              {encrypting ? 'Encrypting...' : 'Encrypt Image'}
            </button>

            {prepared ? (
              <div className="encryption-summary">
                <div>
                  <span className="summary-label">Generated wallet</span>
                  <span className="summary-value">{prepared.walletAddress}</span>
                </div>
                <div>
                  <span className="summary-label">Secret key</span>
                  <span className="summary-value">{prepared.privateKeyHex}</span>
                </div>
                <div>
                  <span className="summary-label">Ciphertext size</span>
                  <span className="summary-value">{prepared.payload.length.toLocaleString()} bytes</span>
                </div>
              </div>
            ) : null}

            <button
              className="secondary-button"
              onClick={handleUpload}
              disabled={!prepared || uploading}
            >
              {uploading ? 'Uploading...' : 'Upload Encrypted Image'}
            </button>

            {ipfsHash ? (
              <div className="ipfs-badge">
                <span>Pseudo CID:</span>
                <span>{ipfsHash}</span>
              </div>
            ) : null}

            <button
              className="primary-button"
              onClick={handlePublish}
              disabled={!prepared || !ipfsHash || publishing || zamaLoading}
            >
              {publishing ? 'Publishing...' : zamaLoading ? 'Initializing encryption...' : 'Publish On-Chain'}
            </button>

            {zamaError ? <p className="error-text">{zamaError}</p> : null}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Encrypted Gallery</h2>
          <p className="card-subtitle">
            Each listing stores an encrypted pseudo CID for the ciphertext. Purchase access for {priceLabel} to unlock
            the FHE-encrypted decryption key.
          </p>

          <div className="gallery-grid">
            {items.length === 0 ? (
              <div className="empty-state">
                <p>No encrypted images yet. Create the first listing above.</p>
              </div>
            ) : (
              items.map((item) => (
                <article key={item.id.toString()} className="gallery-card">
                  <header>
                    <span className="gallery-id">#{item.id.toString()}</span>
                    <span className="gallery-address">{item.creator}</span>
                  </header>
                  <div className="gallery-body">
                    <p className="gallery-hash">
                      <span>Pseudo CID:</span>
                      <span>{item.ipfsHash}</span>
                    </p>
                    <p className="gallery-price">Price: {ethers.formatEther(item.price)} ETH</p>
                    <p className="gallery-created">
                      Listed: {new Date(Number(item.createdAt) * 1000).toLocaleString()}
                    </p>
                  </div>

                  <footer className="gallery-actions">
                    {item.hasAccess ? (
                      <>
                        <button
                          className="primary-button"
                          onClick={() => handleDecrypt(item)}
                          disabled={item.decrypting}
                        >
                          {item.decrypting ? 'Decrypting...' : 'Decrypt & View'}
                        </button>
                        {item.decryptedKeyHex ? (
                          <div className="decrypted-info">
                            <span className="summary-label">Key:</span>
                            <span className="summary-value">{item.decryptedKeyHex}</span>
                          </div>
                        ) : null}
                        {item.decryptedImageUrl ? (
                          <div className="decrypted-preview">
                            <img src={item.decryptedImageUrl} alt="Decrypted" />
                            <a href={item.decryptedImageUrl} download={`decrypted-${item.id}.png`}>
                              Download
                            </a>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <button
                        className="secondary-button"
                        onClick={() => handlePurchase(item)}
                        disabled={item.purchasing || !isConnected}
                      >
                        {item.purchasing ? 'Purchasing...' : isConnected ? `Buy Access (${priceLabel})` : 'Connect wallet'}
                      </button>
                    )}
                  </footer>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
