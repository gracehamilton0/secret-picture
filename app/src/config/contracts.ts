export const CONTRACT_ADDRESS = "0xFb0b8DCA49d84044eed34DF1326eF83826af6b57"

export const CONTRACT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'imageId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'AccessGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'imageId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'creator', type: 'address' },
      { indexed: false, internalType: 'string', name: 'ipfsHash', type: 'string' },
    ],
    name: 'ImageListed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'imageId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'buyer', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'pricePaid', type: 'uint256' },
    ],
    name: 'ImagePurchased',
    type: 'event',
  },
  {
    inputs: [],
    name: 'ACCESS_PRICE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'imageId', type: 'uint256' }],
    name: 'getImage',
    outputs: [
      { internalType: 'address', name: 'creator', type: 'address' },
      { internalType: 'string', name: 'ipfsHash', type: 'string' },
      { internalType: 'uint256', name: 'price', type: 'uint256' },
      { internalType: 'uint256', name: 'createdAt', type: 'uint256' },
      { internalType: 'euint256', name: 'encryptedKey', type: 'bytes32' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getTotalImages',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'imageId', type: 'uint256' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'grantAccess',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'imageId', type: 'uint256' },
      { internalType: 'address', name: 'account', type: 'address' },
    ],
    name: 'hasPurchased',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'string', name: 'ipfsHash', type: 'string' },
      { internalType: 'externalEuint256', name: 'encryptedKey', type: 'bytes32' },
      { internalType: 'bytes', name: 'inputProof', type: 'bytes' },
    ],
    name: 'listEncryptedImage',
    outputs: [{ internalType: 'uint256', name: 'imageId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'protocolId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'pure',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'imageId', type: 'uint256' }],
    name: 'purchaseImage',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
