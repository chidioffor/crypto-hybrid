const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
  let multiSigWallet;
  let owners;
  let nonOwner;
  let recipient;

  beforeEach(async function () {
    [owners[0], owners[1], owners[2], nonOwner, recipient] = await ethers.getSigners();
    
    const MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
    multiSigWallet = await MultiSigWallet.deploy(
      [owners[0].address, owners[1].address, owners[2].address],
      2 // 2 confirmations required
    );
    await multiSigWallet.deployed();

    // Fund the wallet
    await owners[0].sendTransaction({
      to: multiSigWallet.address,
      value: ethers.utils.parseEther("10")
    });
  });

  describe("Deployment", function () {
    it("Should set the correct owners", async function () {
      expect(await multiSigWallet.owners(0)).to.equal(owners[0].address);
      expect(await multiSigWallet.owners(1)).to.equal(owners[1].address);
      expect(await multiSigWallet.owners(2)).to.equal(owners[2].address);
    });

    it("Should set the correct number of confirmations required", async function () {
      expect(await multiSigWallet.numConfirmationsRequired()).to.equal(2);
    });

    it("Should receive ETH deposits", async function () {
      expect(await ethers.provider.getBalance(multiSigWallet.address))
        .to.equal(ethers.utils.parseEther("10"));
    });
  });

  describe("Transaction Submission", function () {
    it("Should allow owners to submit transactions", async function () {
      await expect(
        multiSigWallet.connect(owners[0]).submitTransaction(
          recipient.address,
          ethers.utils.parseEther("1"),
          "0x",
          ethers.constants.AddressZero
        )
      ).to.emit(multiSigWallet, "SubmitTransaction");
    });

    it("Should not allow non-owners to submit transactions", async function () {
      await expect(
        multiSigWallet.connect(nonOwner).submitTransaction(
          recipient.address,
          ethers.utils.parseEther("1"),
          "0x",
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("Not owner");
    });
  });

  describe("Transaction Confirmation", function () {
    let txIndex;

    beforeEach(async function () {
      await multiSigWallet.connect(owners[0]).submitTransaction(
        recipient.address,
        ethers.utils.parseEther("1"),
        "0x",
        ethers.constants.AddressZero
      );
      txIndex = 0;
    });

    it("Should allow owners to confirm transactions", async function () {
      await expect(
        multiSigWallet.connect(owners[0]).confirmTransaction(txIndex)
      ).to.emit(multiSigWallet, "ConfirmTransaction");
    });

    it("Should not allow double confirmation", async function () {
      await multiSigWallet.connect(owners[0]).confirmTransaction(txIndex);
      await expect(
        multiSigWallet.connect(owners[0]).confirmTransaction(txIndex)
      ).to.be.revertedWith("Transaction already confirmed");
    });
  });

  describe("Transaction Execution", function () {
    let txIndex;

    beforeEach(async function () {
      await multiSigWallet.connect(owners[0]).submitTransaction(
        recipient.address,
        ethers.utils.parseEther("1"),
        "0x",
        ethers.constants.AddressZero
      );
      txIndex = 0;
    });

    it("Should execute transaction after sufficient confirmations", async function () {
      await multiSigWallet.connect(owners[0]).confirmTransaction(txIndex);
      await multiSigWallet.connect(owners[1]).confirmTransaction(txIndex);

      const recipientBalanceBefore = await ethers.provider.getBalance(recipient.address);
      
      await expect(
        multiSigWallet.connect(owners[0]).executeTransaction(txIndex)
      ).to.emit(multiSigWallet, "ExecuteTransaction");

      const recipientBalanceAfter = await ethers.provider.getBalance(recipient.address);
      expect(recipientBalanceAfter.sub(recipientBalanceBefore))
        .to.equal(ethers.utils.parseEther("1"));
    });

    it("Should not execute transaction without sufficient confirmations", async function () {
      await multiSigWallet.connect(owners[0]).confirmTransaction(txIndex);
      
      await expect(
        multiSigWallet.connect(owners[0]).executeTransaction(txIndex)
      ).to.be.revertedWith("Cannot execute transaction");
    });
  });
});
