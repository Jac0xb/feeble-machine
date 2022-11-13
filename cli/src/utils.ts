import {
  MAX_CREATOR_LEN,
  MAX_NAME_LENGTH,
  MAX_SYMBOL_LENGTH,
  MAX_URI_LENGTH,
} from "@metaplex-foundation/mpl-token-metadata";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { FeebleMachine } from "../../anchor/target/types/feeble_machine";
import { isKp } from "./types";
import { SystemProgram } from "@solana/web3.js";

export const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID =
  new anchor.web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

export const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

export const getMasterEdition = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

export const getMetadata = async (
  mint: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

export const getMachineCreator = async (
  machine: anchor.web3.PublicKey,
  program: Program<FeebleMachine>
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("FEEBLE"), machine.toBuffer()],
    program.programId
  );
};

export const getMachine = async (
  authority: anchor.web3.PublicKey,
  program: Program<FeebleMachine>
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("FEEBLE"), authority.toBuffer()],
    program.programId
  );
};

export const getWhitelist = async (
  machine: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey,
  program: Program<FeebleMachine>
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [machine.toBuffer(), user.toBuffer()],
    program.programId
  );
};

export const getMintStatus = async (
  machine: anchor.web3.PublicKey,
  index: number,
  program: Program<FeebleMachine>
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [
      Buffer.from("status"),
      machine.toBuffer(),
      new anchor.BN(index).toArrayLike(Buffer, "le", 2),
    ],
    program.programId
  );
};

export const getAtaForMint = async (
  mint: anchor.web3.PublicKey,
  buyer: anchor.web3.PublicKey
): Promise<[anchor.web3.PublicKey, number]> => {
  return await anchor.web3.PublicKey.findProgramAddress(
    [buyer.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID
  );
};

export async function fundWallet(
  provider: anchor.AnchorProvider,
  destiantion: anchor.web3.PublicKey,
  funds: number
) {
  const transaction = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: destiantion,
      lamports: funds * Math.pow(10, 9),
    })
  );

  transaction.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;

  await provider.sendAndConfirm(transaction, undefined, {
    commitment: "confirmed",
    skipPreflight: true,
  });
}

export async function getAccountsByCreatorAddress(
  provider: anchor.AnchorProvider,
  creatorAddress
) {
  const metadataAccounts = await provider.connection.getParsedProgramAccounts(
    TOKEN_METADATA_PROGRAM_ID,
    {
      filters: [
        {
          memcmp: {
            offset:
              1 + // key
              32 + // update auth
              32 + // mint
              4 + // name string length
              MAX_NAME_LENGTH + // name
              4 + // uri string length
              MAX_URI_LENGTH + // uri*
              4 + // symbol string length
              MAX_SYMBOL_LENGTH + // symbol
              2 + // seller fee basis points
              1 + // whether or not there is a creators vec
              4 + // creators vec length
              0 * MAX_CREATOR_LEN,
            bytes: creatorAddress,
          },
        },
      ],
    }
  );

  return metadataAccounts;
}

export const mint = async (
  program: Program<FeebleMachine>,
  authority: anchor.web3.PublicKey,
  payer: anchor.web3.Keypair | anchor.web3.PublicKey,
  feebleMachine: anchor.web3.PublicKey,
  index: number
): Promise<[anchor.web3.PublicKey, anchor.web3.PublicKey]> => {
  const payerPubkey = isKp(payer) ? payer.publicKey : payer;
  const mintSigners = isKp(payer) ? [payer] : [];
  const mint = anchor.web3.Keypair.generate();

  const [tokenAccount] = await getAtaForMint(mint.publicKey, payerPubkey);
  const [mintStatus] = await getMintStatus(feebleMachine, index, program);
  const metadataAddress = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);
  const [whitelist] = await getWhitelist(feebleMachine, payerPubkey, program);
  const [programDerivedCreator, creatorBump] = await getMachineCreator(
    feebleMachine,
    program
  );

  const mintIx = await program.methods
    .mint(creatorBump, index)
    .accounts({
      authority: authority,
      machine: feebleMachine,
      programDerivedCreator: programDerivedCreator,
      payer: payerPubkey,
      whitelist: whitelist,
      reciept: payerPubkey,
      tokenAccount: tokenAccount,
      mint: mint.publicKey,
      mintStatus: mintStatus,
      metadata: metadataAddress,
      masterEdition: masterEdition,
      systemProgram: SystemProgram.programId,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      ataProgram: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  try {
    const tx = new anchor.web3.Transaction();
    tx.add(
      anchor.web3.ComputeBudgetProgram.requestUnits({
        additionalFee: 0,
        units: 3 * 100000,
      })
    );
    tx.add(mintIx);
    await program.provider.connection.sendTransaction(tx, [
      ...mintSigners,
      mint,
    ]);
  } catch (e) {
    console.log(e);
    throw e;
  }

  return [mint.publicKey, metadataAddress];
};
