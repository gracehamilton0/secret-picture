// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint256, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract EncryptedGallery is SepoliaConfig {
    struct EncryptedImage {
        address creator;
        string ipfsHash;
        euint256 encryptedKey;
        uint256 createdAt;
    }

    uint256 public constant ACCESS_PRICE = 0.001 ether;

    uint256 private _nextImageId;
    mapping(uint256 => EncryptedImage) private _images;
    mapping(uint256 => mapping(address => bool)) private _hasPurchased;

    event ImageListed(uint256 indexed imageId, address indexed creator, string ipfsHash);
    event ImagePurchased(uint256 indexed imageId, address indexed buyer, uint256 pricePaid);
    event AccessGranted(uint256 indexed imageId, address indexed account);

    function listEncryptedImage(
        string calldata ipfsHash,
        externalEuint256 encryptedKey,
        bytes calldata inputProof
    ) external returns (uint256 imageId) {
        require(bytes(ipfsHash).length > 0, "Invalid hash");

        euint256 storedKey = FHE.fromExternal(encryptedKey, inputProof);

        imageId = ++_nextImageId;

        EncryptedImage storage image = _images[imageId];
        image.creator = msg.sender;
        image.ipfsHash = ipfsHash;
        image.encryptedKey = storedKey;
        image.createdAt = block.timestamp;

        FHE.allowThis(storedKey);
        FHE.allow(storedKey, msg.sender);

        emit ImageListed(imageId, msg.sender, ipfsHash);
    }

    function purchaseImage(uint256 imageId) external payable {
        EncryptedImage storage image = _images[imageId];
        require(image.creator != address(0), "Image missing");
        require(msg.sender != image.creator, "Creator restricted");
        require(!_hasPurchased[imageId][msg.sender], "Already purchased");
        require(msg.value == ACCESS_PRICE, "Incorrect price");

        _hasPurchased[imageId][msg.sender] = true;

        (bool sent, ) = image.creator.call{value: msg.value}("");
        require(sent, "Payout failed");

        FHE.allow(image.encryptedKey, msg.sender);

        emit ImagePurchased(imageId, msg.sender, msg.value);
        emit AccessGranted(imageId, msg.sender);
    }

    function grantAccess(uint256 imageId, address account) external {
        require(account != address(0), "Invalid account");
        EncryptedImage storage image = _images[imageId];
        require(image.creator != address(0), "Image missing");
        require(image.creator == msg.sender, "Not creator");

        FHE.allow(image.encryptedKey, account);

        emit AccessGranted(imageId, account);
    }

    function getImage(uint256 imageId)
        external
        view
        returns (address creator, string memory ipfsHash, uint256 price, uint256 createdAt, euint256 encryptedKey)
    {
        EncryptedImage storage image = _images[imageId];
        require(image.creator != address(0), "Image missing");

        return (image.creator, image.ipfsHash, ACCESS_PRICE, image.createdAt, image.encryptedKey);
    }

    function getTotalImages() external view returns (uint256) {
        return _nextImageId;
    }

    function hasPurchased(uint256 imageId, address account) external view returns (bool) {
        EncryptedImage storage image = _images[imageId];
        require(image.creator != address(0), "Image missing");
        return account == image.creator || _hasPurchased[imageId][account];
    }
}
