import * as dotenv from "dotenv";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

dotenv.config();

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedGallery = await deploy("EncryptedGallery", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedGallery contract:`, deployedGallery.address);
};
export default func;
func.id = "deploy_encryptedGallery";
func.tags = ["EncryptedGallery"];
