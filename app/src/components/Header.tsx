import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

type HeaderProps = {
  onRefresh: () => void;
  refreshing: boolean;
};

export function Header({ onRefresh, refreshing }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">Secret Picture Gallery</h1>
            <p className="header-subtitle">
              Encrypt images locally, store encrypted art on IPFS, and trade decryption keys securely with FHE.
            </p>
            <button className="refresh-button" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh Gallery'}
            </button>
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
