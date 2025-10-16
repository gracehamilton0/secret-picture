import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedGallery, EncryptedGallery__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type SignerSet = {
  creator: HardhatEthersSigner;
  buyer: HardhatEthersSigner;
  other: HardhatEthersSigner;
};

describe("EncryptedGallery", function () {
  let signers: SignerSet;
  let gallery: EncryptedGallery;
  let galleryAddress: string;

  before(async function () {
    const [creator, buyer, other] = await ethers.getSigners();
    signers = { creator, buyer, other };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    const factory = (await ethers.getContractFactory("EncryptedGallery")) as EncryptedGallery__factory;
    gallery = (await factory.deploy()) as EncryptedGallery;
    galleryAddress = await gallery.getAddress();
  });

  async function encryptKeyFor(address: string, value: bigint) {
    const registration = await fhevm.createEncryptedInput(galleryAddress, address);
    registration.add256(value);
    return registration.encrypt();
  }

  async function listSampleImage(secretKey: bigint = 5n) {
    const encryptedInput = await encryptKeyFor(signers.creator.address, secretKey);
    const tx = await gallery
      .connect(signers.creator)
      .listEncryptedImage("ipfs://sample-hash", encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();
    return { secretKey };
  }

  it("stores encrypted image metadata", async function () {
    const secretKey = 12345678901234567890n;
    const encryptedInput = await encryptKeyFor(signers.creator.address, secretKey);

    const tx = await gallery
      .connect(signers.creator)
      .listEncryptedImage("ipfs://encrypted-image", encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const total = await gallery.getTotalImages();
    expect(total).to.equal(1n);

    const image = await gallery.getImage(1n);
    expect(image.creator).to.equal(signers.creator.address);
    expect(image.ipfsHash).to.equal("ipfs://encrypted-image");
    expect(image.price).to.equal(await gallery.ACCESS_PRICE());
    expect(image.encryptedKey).to.not.equal(ethers.ZeroHash);

    const clearKey = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      image.encryptedKey,
      galleryAddress,
      signers.creator,
    );
    expect(clearKey).to.equal(secretKey);
  });

  it("sells access to encrypted key for fixed price", async function () {
    const secretKey = 987654321n;
    await listSampleImage(secretKey);

    const price = await gallery.ACCESS_PRICE();

    const creatorBalanceBefore = await ethers.provider.getBalance(signers.creator.address);

    await expect(
      gallery.connect(signers.buyer).purchaseImage(1n, { value: price }),
    ).to.emit(gallery, "ImagePurchased").withArgs(1n, signers.buyer.address, price);

    const creatorBalanceAfter = await ethers.provider.getBalance(signers.creator.address);
    expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(price);

    const hasBuyerAccess = await gallery.hasPurchased(1n, signers.buyer.address);
    expect(hasBuyerAccess).to.equal(true);

    const image = await gallery.getImage(1n);
    const decryptedBuyerKey = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      image.encryptedKey,
      galleryAddress,
      signers.buyer,
    );
    expect(decryptedBuyerKey).to.equal(secretKey);
  });

  it("allows creator to grant access manually", async function () {
    const secretKey = 4444n;
    await listSampleImage(secretKey);

    await expect(
      gallery.connect(signers.creator).grantAccess(1n, signers.other.address),
    ).to.emit(gallery, "AccessGranted").withArgs(1n, signers.other.address);

    const image = await gallery.getImage(1n);
    const decryptedKey = await fhevm.userDecryptEuint(
      FhevmType.euint256,
      image.encryptedKey,
      galleryAddress,
      signers.other,
    );

    expect(decryptedKey).to.equal(secretKey);
  });

  it("prevents repeated purchases", async function () {
    await listSampleImage(15n);

    const price = await gallery.ACCESS_PRICE();

    await gallery.connect(signers.buyer).purchaseImage(1n, { value: price });

    await expect(
      gallery.connect(signers.buyer).purchaseImage(1n, { value: price }),
    ).to.be.revertedWith("Already purchased");
  });
});
