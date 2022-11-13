import { program } from "commander";
import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

import { FeebleMachine, IDL } from "../../anchor/target/types/feeble_machine";
import { getMachine, getWhitelist } from "./utils";

function programCommand(name: string) {
  return program
    .command(name)
    .requiredOption("-k, --keypair <path>", `Solana wallet location`)
    .requiredOption("-m, --minter <pubkey>", `Minter`)
    .requiredOption("-a, --amount <pubkey>", `Amount whitelist can mint`)
    .requiredOption("-r", "--rpc <url>", "solana rpc");
}

programCommand("whitelist").action(async (directory, cmd) => {
  const { keypair, rpc, minter } = cmd.opts();

  const connection = new web3.Connection(rpc, {
    commitment: "processed",
    confirmTransactionInitialTimeout: 120 * 1000,
  });

  if (minter == "") {
    throw new Error("Expected minter");
  }

  // Load wallet.
  const walletKeyPair = loadWalletKey(keypair);
  const walletWrapper = new anchor.Wallet(walletKeyPair);

  const program = new Program<FeebleMachine>(
    IDL,
    new PublicKey("VENDzam3eJ4Kn8KmVndH7qdF23jMf3NkogyLvA5XJxV"),
    new anchor.AnchorProvider(connection, walletWrapper, {})
  );

  const minterPK = new web3.PublicKey(minter);
  const [machine] = await getMachine(walletWrapper.publicKey, program);
  const [whitelist] = await getWhitelist(machine, minterPK, program);

  await program.methods
    .whitelistUser(1)
    .accounts({
      user: minterPK,
      authority: walletKeyPair.publicKey,
      machine: machine,
      whitelist: whitelist,
    })
    .rpc();
});

export function loadWalletKey(keypair: string) {
  if (!keypair || keypair == "") {
    throw new Error("Keypair is required!");
  }
  const loaded = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
  );
  console.info(`wallet public key: ${loaded.publicKey}`);
  return loaded;
}
