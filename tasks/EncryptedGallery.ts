import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("gallery:address", "Prints the EncryptedGallery address").setAction(async (_args: TaskArguments, hre) => {
  const { deployments } = hre;
  const deployment = await deployments.get("EncryptedGallery");
  console.log(`EncryptedGallery: ${deployment.address}`);
});

task("gallery:list", "List a new encrypted image")
  .addParam("hash", "IPFS hash of the encrypted image")
  .addParam("key", "Secret key encoded as uint256")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments, ethers, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("EncryptedGallery");
    const [signer] = await ethers.getSigners();

    const secretKey = BigInt(args.key as string);
    const ciphertext = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add256(secretKey)
      .encrypt();

    const contract = await ethers.getContractAt("EncryptedGallery", deployment.address);
    const tx = await contract
      .connect(signer)
      .listEncryptedImage(args.hash as string, ciphertext.handles[0], ciphertext.inputProof);
    const receipt = await tx.wait();

    console.log(`Listed image in tx ${tx.hash} (status: ${receipt?.status})`);
  });

task("gallery:get", "Reads image metadata")
  .addParam("id", "Image identifier")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("EncryptedGallery");
    const contract = await ethers.getContractAt("EncryptedGallery", deployment.address);

    const id = BigInt(args.id as string);
    const image = await contract.getImage(id);

    console.log(`Creator: ${image.creator}`);
    console.log(`IPFS hash: ${image.ipfsHash}`);
    console.log(`Price: ${image.price}`);
    console.log(`Created at: ${image.createdAt}`);
    console.log(`Encrypted key handle: ${image.encryptedKey}`);
  });

task("gallery:purchase", "Purchase access to an image")
  .addParam("id", "Image identifier")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("EncryptedGallery");
    const contract = await ethers.getContractAt("EncryptedGallery", deployment.address);
    const [signer] = await ethers.getSigners();

    const id = BigInt(args.id as string);
    const price = await contract.ACCESS_PRICE();

    const tx = await contract.connect(signer).purchaseImage(id, { value: price });
    const receipt = await tx.wait();

    console.log(`Purchased image ${id} in tx ${tx.hash} (status: ${receipt?.status})`);
  });

task("gallery:grant", "Creator grants access to another account")
  .addParam("id", "Image identifier")
  .addParam("account", "Account to grant access")
  .setAction(async (args: TaskArguments, hre) => {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("EncryptedGallery");
    const contract = await ethers.getContractAt("EncryptedGallery", deployment.address);
    const [signer] = await ethers.getSigners();

    const id = BigInt(args.id as string);
    const tx = await contract.connect(signer).grantAccess(id, args.account as string);
    const receipt = await tx.wait();

    console.log(`Granted access to ${args.account} for image ${id} (tx: ${tx.hash}, status: ${receipt?.status})`);
  });
