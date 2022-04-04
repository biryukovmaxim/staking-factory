import * as anchor from "@project-serum/anchor";
import { Program,web3} from "@project-serum/anchor";
import { StakingFactory } from "../target/types/staking_factory";
// import {SystemProgram, Keypair} from "@solana/web3.js"

describe("staking-factory", () => {
  const provider = anchor.Provider.env();
  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  const program = anchor.workspace.StakingFactory as Program<StakingFactory>;

  let factoryCreator = web3.Keypair.generate();
  it("Is initialized!", async () => {
    await provider.connection.requestAirdrop(factoryCreator.publicKey,  anchor.web3.LAMPORTS_PER_SOL);
    const [factoryCreatorPda, _] = await anchor.web3.PublicKey.findProgramAddress(
        // @ts-ignore
        ['factory_creator'],
        program.programId
    );
    const tx = await program.rpc.initialize(3,{
      accounts: {
        factoryCreator: factoryCreator.publicKey,
        creatorPda: factoryCreatorPda,
        systemProgram: web3.SystemProgram.programId,
      },
      signers: [factoryCreator],

    });
    console.log("Your transaction signature", tx);
  });
});
