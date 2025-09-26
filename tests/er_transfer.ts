import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ErTransfer } from "../target/types/er_transfer";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";
import { BN } from "bn.js";

let provider = anchor.AnchorProvider.env()
anchor.setProvider(provider);

const program = anchor.workspace.erTransfer as Program<ErTransfer>;

let userBalanceAccount: PublicKey;
let magicRouterSdk: any;
let bobAccount: Keypair;
let bobBalanceAccount: PublicKey;

describe("er_transfer", () => {

  const routerConnection = new web3.Connection(
    process.env.ROUTER_ENDPOINT || "https://devnet-router.magicblock.app",
    {
      wsEndpoint: process.env.ROUTER_WS_ENDPOINT || "wss://devnet-router.magicblock.app",
    }
  );

  before(async () => {

    bobAccount = Keypair.generate();

    magicRouterSdk = await import("magic-router-sdk");
    
    [userBalanceAccount] = PublicKey.findProgramAddressSync(
      [provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    [bobBalanceAccount] = PublicKey.findProgramAddressSync(
      [bobAccount.publicKey.toBuffer()],
      program.programId
    );

    // const airdropSignature = await provider.connection.requestAirdrop(
    //   bobAccount.publicKey,
    //   2 * web3.LAMPORTS_PER_SOL 
    // );
      
    // const latestBlockHash = await provider.connection.getLatestBlockhash();
    // await provider.connection.confirmTransaction({
    //   blockhash: latestBlockHash.blockhash,
    //   lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    //   signature: airdropSignature,
    // });
  })

  it("Initialize", async () => {
    const tx = await program.methods.initialize().accountsPartial({
      user: provider.wallet.publicKey,
      balance: userBalanceAccount,
      systemProgram: SystemProgram.programId,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Initialize Bob", async () => {
    const tx = await program.methods.initialize().accountsPartial({
      user: bobAccount.publicKey,
      balance: bobBalanceAccount,
      systemProgram: SystemProgram.programId,
    }).signers([bobAccount]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Delegate Balance", async () => {
    let validatorKey = await magicRouterSdk.getClosestValidator(routerConnection);
    const tx = await program.methods.delegateBalance({
      commitFrequencyMs: 30000,
      validator: validatorKey,
    }).accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Delegate Bob Balance", async () => {
      let validatorKey = await magicRouterSdk.getClosestValidator(routerConnection);
      const tx = await program.methods.delegateBalance({
        commitFrequencyMs: 30000,
        validator: validatorKey,
      }).accountsPartial({
        payer: bobAccount.publicKey,
        balance: bobBalanceAccount,
      }).signers([bobAccount]).rpc();

      console.log(`Transaction Signature: ${tx}`);
  });

  it("Transfer", async () => {
    let amount = new BN(1);

    const tx = await program.methods.transfer(amount).accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount,
      receiver: bobAccount.publicKey,
      receiverBalance: bobBalanceAccount,
      systemProgram: SystemProgram.programId,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Undelegate", async () => {
    const tx = await program.methods.undelegate().accountsPartial({
      payer: provider.wallet.publicKey,
      balance: userBalanceAccount,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  })

});