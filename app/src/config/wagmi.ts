import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'viem';
import { sepolia } from 'wagmi/chains';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'projectId';
const infuraKey = import.meta.env.VITE_INFURA_API_KEY ?? '';

export const config = getDefaultConfig({
  appName: 'Secret Picture Gallery',
  projectId,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      infuraKey && infuraKey.trim().length > 0
        ? `https://sepolia.infura.io/v3/${infuraKey}`
        : sepolia.rpcUrls.default.http[0],
    ),
  },
  ssr: false,
});
