import { describe, expect, it, beforeEach } from "vitest";
import { ClarityValue, uintCV, someCV, noneCV, principalCV, standardPrincipalCV } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;

// Generate 20 board member addresses
const boardMembers: string[] = [];
for (let i = 1; i <= 20; i++) {
  const wallet = accounts.get(`wallet_${i}` as any);
  if (wallet) {
    boardMembers.push(wallet);
  } else {
    // If we don't have enough wallets, use deployer with different indices
    boardMembers.push(deployer);
  }
}

describe("BoardMultiSig Contract", () => {
  beforeEach(() => {
    // Initialize contract with 20 board members before each test
    const members = boardMembers.map(m => standardPrincipalCV(m));
    const initResult = simnet.callPublicFn(
      "multbox",
      "initialize",
      [members],
      deployer
    );
    expect(initResult.result).toBeOk(ClarityValue.from(true));
  });

  describe("Initialization", () => {
    it("should initialize with exactly 20 board members", () => {
      const members = boardMembers.map(m => standardPrincipalCV(m));
      const result = simnet.callPublicFn(
        "multbox",
        "initialize",
        [members],
        deployer
      );
      expect(result.result).toBeOk(ClarityValue.from(true));
    });

    it("should fail if initialized twice", () => {
      const members = boardMembers.map(m => standardPrincipalCV(m));
      const result1 = simnet.callPublicFn(
        "multbox",
        "initialize",
        [members],
        deployer
      );
      expect(result1.result).toBeOk(ClarityValue.from(true));

      const result2 = simnet.callPublicFn(
        "multbox",
        "initialize",
        [members],
        deployer
      );
      expect(result2.result).toBeErr(uintCV(1001));
    });

    it("should fail with wrong number of members", () => {
      const wrongMembers = boardMembers.slice(0, 19).map(m => standardPrincipalCV(m));
      const result = simnet.callPublicFn(
        "multbox",
        "initialize",
        [wrongMembers],
        deployer
      );
      expect(result.result).toBeErr(uintCV(1002));
    });

    it("should verify board members are registered", () => {
      const isMember = simnet.callReadOnlyFn(
        "multbox",
        "is-board-member",
        [standardPrincipalCV(boardMembers[0])],
        deployer
      );
      expect(isMember.result).toBeSome(ClarityValue.from(true));
    });

    it("should return correct board member count", () => {
      const count = simnet.callReadOnlyFn(
        "multbox",
        "get-board-member-count",
        [],
        deployer
      );
      expect(count.result).toBeUint(20);
    });
  });

  describe("Transaction Proposal", () => {
    it("should allow board member to propose transaction", () => {
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      const result = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );

      expect(result.result).toBeOk(uintCV(0));
    });

    it("should fail if non-board member proposes", () => {
      const nonMember = accounts.get("faucet")!;
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      const result = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        nonMember
      );

      expect(result.result).toBeErr(uintCV(1005));
    });

    it("should fail with zero amount", () => {
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(0);
      const tokenContract = noneCV();

      const result = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );

      expect(result.result).toBeErr(uintCV(1006));
    });

    it("should auto-approve by proposer", () => {
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      const proposeResult = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );
      expect(proposeResult.result).toBeOk(uintCV(0));

      // Check approval count
      const approvalCount = simnet.callReadOnlyFn(
        "multbox",
        "get-approval-count",
        [uintCV(0)],
        deployer
      );
      expect(approvalCount.result).toBeUint(1);

      // Check if proposer has approved
      const hasApproved = simnet.callReadOnlyFn(
        "multbox",
        "has-approved",
        [uintCV(0), standardPrincipalCV(boardMembers[0])],
        deployer
      );
      expect(hasApproved.result).toBeSome(ClarityValue.from(true));
    });
  });

  describe("Transaction Approval", () => {
    beforeEach(() => {
      // Create a transaction for testing approvals
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );
    });

    it("should allow board members to approve", () => {
      const result = simnet.callPublicFn(
        "multbox",
        "approve-transaction",
        [uintCV(0)],
        boardMembers[1]
      );

      expect(result.result).toBeOk(ClarityValue.from(true));

      const approvalCount = simnet.callReadOnlyFn(
        "multbox",
        "get-approval-count",
        [uintCV(0)],
        deployer
      );
      expect(approvalCount.result).toBeUint(2);
    });

    it("should fail if non-board member approves", () => {
      const nonMember = accounts.get("faucet")!;
      const result = simnet.callPublicFn(
        "multbox",
        "approve-transaction",
        [uintCV(0)],
        nonMember
      );

      expect(result.result).toBeErr(uintCV(1005));
    });

    it("should fail if member approves twice", () => {
      // First approval
      const result1 = simnet.callPublicFn(
        "multbox",
        "approve-transaction",
        [uintCV(0)],
        boardMembers[1]
      );
      expect(result1.result).toBeOk(ClarityValue.from(true));

      // Second approval (should fail)
      const result2 = simnet.callPublicFn(
        "multbox",
        "approve-transaction",
        [uintCV(0)],
        boardMembers[1]
      );
      expect(result2.result).toBeErr(uintCV(1008));
    });

    it("should fail if transaction doesn't exist", () => {
      const result = simnet.callPublicFn(
        "multbox",
        "approve-transaction",
        [uintCV(999)],
        boardMembers[1]
      );

      expect(result.result).toBeErr(uintCV(1007));
    });
  });

  describe("Transaction Execution", () => {

    it("should execute transaction with majority approval (11/20)", () => {
      // Note: This test verifies the execution logic works correctly
      // In a real scenario, the contract would need to have STX balance
      // Propose transaction
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      const proposeResult = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );
      expect(proposeResult.result).toBeOk(uintCV(0));

      // Get 10 more approvals (total 11, which is majority)
      for (let i = 1; i <= 10; i++) {
        const approveResult = simnet.callPublicFn(
          "multbox",
          "approve-transaction",
          [uintCV(0)],
          boardMembers[i]
        );
        expect(approveResult.result).toBeOk(ClarityValue.from(true));
      }

      // Check approval count
      const approvalCount = simnet.callReadOnlyFn(
        "multbox",
        "get-approval-count",
        [uintCV(0)],
        deployer
      );
      expect(approvalCount.result).toBeUint(11);

      // Execute transaction (may fail if contract has no STX, but logic is correct)
      const executeResult = simnet.callPublicFn(
        "multbox",
        "execute-transaction",
        [uintCV(0)],
        deployer
      );
      // The execution will attempt to transfer, which may fail if no balance
      // but the important thing is that it passes the approval checks
      // In a real scenario with balance, this would succeed
      expect(executeResult.result).toBeOk(ClarityValue.from(true));
    });

    it("should fail with insufficient approvals", () => {
      // Propose transaction
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      const proposeResult = simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );
      expect(proposeResult.result).toBeOk(uintCV(0));

      // Get only 5 more approvals (total 6, which is less than majority)
      for (let i = 1; i <= 5; i++) {
        simnet.callPublicFn(
          "multbox",
          "approve-transaction",
          [uintCV(0)],
          boardMembers[i]
        );
      }

      // Try to execute (should fail)
      const executeResult = simnet.callPublicFn(
        "multbox",
        "execute-transaction",
        [uintCV(0)],
        deployer
      );
      expect(executeResult.result).toBeErr(uintCV(1010));
    });

    it("should fail if transaction already executed", () => {
      // Propose and get majority approval
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(1000);
      const tokenContract = noneCV();

      simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );

      // Get 10 more approvals
      for (let i = 1; i <= 10; i++) {
        simnet.callPublicFn(
          "multbox",
          "approve-transaction",
          [uintCV(0)],
          boardMembers[i]
        );
      }

      // Execute first time
      const executeResult1 = simnet.callPublicFn(
        "multbox",
        "execute-transaction",
        [uintCV(0)],
        deployer
      );
      expect(executeResult1.result).toBeOk(ClarityValue.from(true));

      // Try to execute again (should fail)
      const executeResult2 = simnet.callPublicFn(
        "multbox",
        "execute-transaction",
        [uintCV(0)],
        deployer
      );
      expect(executeResult2.result).toBeErr(uintCV(1009));
    });

    it("should fail if transaction doesn't exist", () => {
      const executeResult = simnet.callPublicFn(
        "multbox",
        "execute-transaction",
        [uintCV(999)],
        deployer
      );
      expect(executeResult.result).toBeErr(uintCV(1007));
    });
  });

  describe("Read-only Functions", () => {
    it("should return transaction details", () => {
      // Propose a transaction
      const recipient = standardPrincipalCV(boardMembers[1]);
      const amount = uintCV(5000);
      const tokenContract = noneCV();

      simnet.callPublicFn(
        "multbox",
        "propose-transaction",
        [recipient, amount, tokenContract],
        boardMembers[0]
      );

      // Get transaction details
      const tx = simnet.callReadOnlyFn(
        "multbox",
        "get-transaction",
        [uintCV(0)],
        deployer
      );
      expect(tx.result).toBeSome();
    });

    it("should check if contract is initialized", () => {
      const initialized = simnet.callReadOnlyFn(
        "multbox",
        "is-initialized",
        [],
        deployer
      );
      expect(initialized.result).toBeSome(ClarityValue.from(true));
    });
  });
});
