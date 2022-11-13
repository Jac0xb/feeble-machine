import { program } from "commander";
import { PromisePool } from "@supercharge/promise-pool";
import axios from "axios";

function programCommand(name: string) {
  return program.command(name);
}

const PATH = "ARWEAVE MANIFEST PATH";
const EXT = "png";

programCommand("verify_manifest").action(async (directory, cmd) => {
  const fileIndex = [];

  for (var i = 0; i < 10000; i++) {
    fileIndex.push(i);
  }

  const { results } = await PromisePool.withConcurrency(64)
    .for(fileIndex)
    .process(async (i, index) => {
      const result = await axios.get(`${PATH}/${i}.${EXT}`);

      if (index % 32) {
        console.log(".");
      }

      if (result.status >= 200 && result.status < 300) {
        return true;
      } else {
        console.log(`Failure at ${i} | ${index}`);
        return false;
      }
    });

  console.log(
    `Succeeded:  ${results.filter((b) => b === true)} Failed ${results.filter(
      (b) => b === false
    )} `
  );
});
