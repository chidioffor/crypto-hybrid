const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy Governance Token
  console.log("\nDeploying Governance Token...");
  const GovernanceToken = await ethers.getContractFactory("GovernanceToken");
  const governanceToken = await GovernanceToken.deploy(
    "CryptoHybrid Governance Token",
    "CHGT",
    ethers.utils.parseEther("1000000"), // 1M tokens
    deployer.address
  );
  await governanceToken.deployed();
  console.log("GovernanceToken deployed to:", governanceToken.address);

  // Deploy DAO Governance
  console.log("\nDeploying DAO Governance...");
  const DAOGovernance = await ethers.getContractFactory("DAOGovernance");
  const daoGovernance = await DAOGovernance.deploy(governanceToken.address);
  await daoGovernance.deployed();
  console.log("DAOGovernance deployed to:", daoGovernance.address);

  // Deploy MultiSig Wallet
  console.log("\nDeploying MultiSig Wallet...");
  const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
  const owners = [deployer.address]; // Add more owners as needed
  const required = 1; // Number of confirmations required
  const multiSigWallet = await MultiSigWallet.deploy(owners, required);
  await multiSigWallet.deployed();
  console.log("MultiSigWallet deployed to:", multiSigWallet.address);

  // Deploy Escrow
  console.log("\nDeploying Escrow...");
  const Escrow = await ethers.getContractFactory("Escrow");
  const escrow = await Escrow.deploy(deployer.address); // Fee recipient
  await escrow.deployed();
  console.log("Escrow deployed to:", escrow.address);

  // Deploy Asset Tokenization Factory
  console.log("\nDeploying Asset Tokenization Factory...");
  const AssetTokenizationFactory = await ethers.getContractFactory("AssetTokenizationFactory");
  const factory = await AssetTokenizationFactory.deploy(deployer.address); // Fee recipient
  await factory.deployed();
  console.log("AssetTokenizationFactory deployed to:", factory.address);

  // Create a sample tokenized asset
  console.log("\nCreating sample tokenized asset...");
  const metadata = {
    assetType: "real_estate",
    description: "Luxury apartment building in downtown",
    location: "New York, NY",
    totalValue: ethers.utils.parseEther("1000000"), // $1M
    documentHash: "QmSampleHash123456789",
    custodian: deployer.address,
    creationDate: 0, // Will be set by contract
    isActive: true
  };

  const creationFee = await factory.creationFee();
  const tx = await factory.createTokenizedAsset(
    "Downtown Apartments Token",
    "DAT",
    ethers.utils.parseEther("1000"), // 1000 tokens
    metadata,
    { value: creationFee }
  );
  const receipt = await tx.wait();
  
  // Get the tokenized asset address from the event
  const event = receipt.events?.find(e => e.event === 'AssetTokenized');
  const tokenAddress = event?.args?.tokenAddress;
  console.log("Sample TokenizedAsset deployed to:", tokenAddress);

  // Summary
  console.log("\n=== Deployment Summary ===");
  console.log("GovernanceToken:", governanceToken.address);
  console.log("DAOGovernance:", daoGovernance.address);
  console.log("MultiSigWallet:", multiSigWallet.address);
  console.log("Escrow:", escrow.address);
  console.log("AssetTokenizationFactory:", factory.address);
  console.log("Sample TokenizedAsset:", tokenAddress);

  // Save deployment addresses
  const fs = require('fs');
  const deploymentInfo = {
    network: await ethers.provider.getNetwork(),
    deployer: deployer.address,
    contracts: {
      GovernanceToken: governanceToken.address,
      DAOGovernance: daoGovernance.address,
      MultiSigWallet: multiSigWallet.address,
      Escrow: escrow.address,
      AssetTokenizationFactory: factory.address,
      SampleTokenizedAsset: tokenAddress
    },
    deploymentTime: new Date().toISOString()
  };

  fs.writeFileSync(
    'deployment.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\nDeployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
