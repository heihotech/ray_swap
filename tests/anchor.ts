import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import assert from "assert";
import * as web3 from "@solana/web3.js";
import type { SolanaLamportTransfer } from "../target/types/solana_lamport_transfer";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaLamportTransfer as anchor.Program<SolanaLamportTransfer>;
  
  it("transferLamports", async () => {
    // Generate keypair for the new account
    const newAccountKp = new web3.Keypair();
    // Send transaction
    const data = new BN(1000000);
    const txHash = await program.methods
      .transferLamports(data)
      .accounts({
        from: program.provider.publicKey,
        to: newAccountKp.publicKey,
      })
      .signers([program.provider.wallet.payer])
      .rpc();
    console.log(`https://solscan.io/tx/${txHash}?cluster=devnet`);
    await program.provider.connection.confirmTransaction(txHash, "finalized");
    const newAccountBalance = await program.provider.connection.getBalance(
      newAccountKp.publicKey
    );
    assert.strictEqual(
      newAccountBalance,
      data.toNumber(),
      "The new account should have the transferred lamports"
    );
  });

  it("transferSplTokens", async () => {
    // Generate keypairs for the new accounts
    const fromKp = program.provider.wallet.payer;
    const toKp = new web3.Keypair();

    // Create a new mint and initialize it
    const mintKp = new web3.Keypair();
    const mint = await createMint(
      program.provider.connection,
      program.provider.wallet.payer,
      fromKp.publicKey,
      null,
      0
    );

    // Create associated token accounts for the new accounts
    const fromAta = await createAssociatedTokenAccount(
      program.provider.connection,
      program.provider.wallet.payer,
      mint,
      fromKp.publicKey
    );
    const toAta = await createAssociatedTokenAccount(
      program.provider.connection,
      program.provider.wallet.payer,
      mint,
      toKp.publicKey
    );
    // Mint tokens to the 'from' associated token account
    const mintAmount = 1000;
    await mintTo(
      program.provider.connection,
      program.provider.wallet.payer,
      mint,
      fromAta,
      program.provider.wallet.payer.publicKey,
      mintAmount
    );

    // Send transaction
    const transferAmount = new BN(500);
    const txHash = await program.methods
      .transferSplTokens(transferAmount)
      .accounts({
        from: fromKp.publicKey,
        fromAta: fromAta,
        toAta: toAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([program.provider.wallet.payer, fromKp])
      .rpc();
    console.log(`https://explorer.solana.com/tx/${txHash}?cluster=devnet`);
    await program.provider.connection.confirmTransaction(txHash, "finalized");
    const toTokenAccount = await program.provider.connection.getTokenAccountBalance(toAta);
    assert.strictEqual(
      toTokenAccount.value.uiAmount,
      transferAmount.toNumber(),
      "The 'to' token account should have the transferred tokens"
    );
  });
});
