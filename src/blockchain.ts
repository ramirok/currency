import CryptoJS from "crypto-js";
import { broadcastLatest, broadCastTransactionPool } from "./p2p";
import { hexToBinary } from "./util";
import {
  UnspentTxOut,
  Transaction,
  processTransactions,
  getCoinbaseTransaction,
  isValidAddress,
} from "./transactions";
import {
  createTransaction,
  getBalance,
  getPrivateFromWallet,
  getPublicFromWallet,
  findUnspentTxOuts,
} from "./wallet";

import {
  addToTransactionPool,
  getTransactionPool,
  updateTransactionPool,
} from "./transactionPool";
import _ from "lodash";

const BLOCK_GENERATION_INTERVAL: number = 10;
const DIFFICULTY_ADJUSTMENT_INTERVAL: number = 10;

class Block {
  public index: number;
  public hash: string;
  public previousHash: string | null;
  public timestamp: number;
  public data: Transaction[];
  public difficulty: number;
  public nonce: number;

  constructor(
    index: number,
    hash: string,
    previousHash: string | null,
    timestamp: number,
    data: Transaction[],
    difficulty: number,
    nonce: number
  ) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
    this.difficulty = difficulty;
    this.nonce = nonce;
  }
}

const genesisTransaction = {
  txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
  txOuts: [
    {
      address:
        "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a",
      amount: 50,
    },
  ],
  id: "e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3",
};

const genesisBlock = new Block(
  0,
  "91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627",
  "",
  1465154705,
  [genesisTransaction],
  0,
  0
);

let blockchain: Block[] = [genesisBlock];
let unspentTxOuts: UnspentTxOut[] =
  processTransactions(blockchain[0]?.data!, [], 0) || [];

const getBlockchain = (): Block[] => blockchain;

const getUnspentTxOuts = (): UnspentTxOut[] => _.cloneDeep(unspentTxOuts);

const getLatestBlock = (): Block => blockchain[blockchain.length - 1]!;

const setUnspentTxOuts = (newUnspentTxOut: UnspentTxOut[]) => {
  console.log(`replacing unspentTxouts with: ${newUnspentTxOut}`);
  unspentTxOuts = newUnspentTxOut;
};

const calculateHashForBlock = (block: Block): string =>
  calculateHash(
    block.index,
    block.previousHash!,
    block.timestamp,
    block.data,
    block.difficulty,
    block.nonce
  );

const generateNextBlock = () => {
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  );
  const blockData: Transaction[] = [coinbaseTx].concat(getTransactionPool());
  return generateRawNextBlock(blockData);
};

const generatenextBlockWithTransactions = (
  receiverAddress: string,
  amount: number
) => {
  if (!isValidAddress(receiverAddress)) {
    throw new Error("invalid address");
  }
  if (typeof amount !== "number") {
    throw new Error("invalid amount");
  }
  const coinbaseTx: Transaction = getCoinbaseTransaction(
    getPublicFromWallet(),
    getLatestBlock().index + 1
  );
  const tx: Transaction = createTransaction(
    receiverAddress,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  );
  const blockData: Transaction[] = [coinbaseTx, tx];
  return generateRawNextBlock(blockData);
};

const calculateHash = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number,
  nonce: number
): string =>
  CryptoJS.SHA256(
    index + previousHash + timestamp + data + difficulty + nonce
  ).toString();

const isValidBlockStructure = (block: Block): boolean => {
  return (
    typeof block.index === "number" &&
    typeof block.hash === "string" &&
    typeof block.previousHash === "string" &&
    typeof block.timestamp === "number" &&
    typeof block.data === "object"
  );
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (!isValidBlockStructure(newBlock)) {
    console.log(`invalid block structure: ${JSON.stringify(newBlock)}`);
    return false;
  }
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log("invalid index");
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log("invalid previous hash");
    return false;
  } else if (!isValidTimestamp(newBlock, previousBlock)) {
    console.log("invalid timestamp");
    return false;
  } else if (!hasValidHash(newBlock)) {
    return false;
  }
  return true;
};

const isValidChain = (blockchainToValidate: Block[]): UnspentTxOut[] | null => {
  console.log("isValidChain:");
  console.log(JSON.stringify(blockchainToValidate));

  const isValidGenesis = (block: Block): boolean => {
    return JSON.stringify(block) === JSON.stringify(genesisBlock);
  };

  if (!isValidGenesis(blockchainToValidate[0]!)) {
    return null;
  }
  // validate each block in the chain. The block is valid if the block structure is valid and the transaction are valid
  let aUnspentTxOuts: UnspentTxOut[] | null = [];

  for (let i = 0; i < blockchainToValidate.length; i++) {
    const currentBlock: Block = blockchainToValidate[i]!;
    if (
      i !== 0 &&
      !isValidNewBlock(blockchainToValidate[i]!, blockchainToValidate[i - 1]!)
    ) {
      return null;
    }

    aUnspentTxOuts = processTransactions(
      currentBlock.data,
      aUnspentTxOuts,
      currentBlock.index
    );
    if (aUnspentTxOuts === null) {
      console.log("invalid transactions in blockchain");
      return null;
    }
  }
  return aUnspentTxOuts;
};

const addBlockToChain = (newBlock: Block): boolean => {
  if (isValidNewBlock(newBlock, getLatestBlock())) {
    const retVal: UnspentTxOut[] | null = processTransactions(
      newBlock.data,
      getUnspentTxOuts(),
      newBlock.index
    );
    if (retVal === null) {
      console.log("block is not valid in terms of transactions");
      return false;
    } else {
      blockchain.push(newBlock);
      setUnspentTxOuts(retVal);
      updateTransactionPool(unspentTxOuts);
      return true;
    }
  }
  return false;
};

const replaceChain = (newBlocks: Block[]) => {
  const aUnspentTxOuts = isValidChain(newBlocks);
  const validChain: boolean = aUnspentTxOuts !== null;
  if (
    validChain &&
    getAccumulatedDifficulty(newBlocks) >
      getAccumulatedDifficulty(getBlockchain())
  ) {
    console.log(
      "Received blockchain is valid. Replacing current blockchain with received blockchain"
    );
    blockchain = newBlocks;
    setUnspentTxOuts(aUnspentTxOuts!);
    updateTransactionPool(unspentTxOuts);
    broadcastLatest();
  } else {
    console.log("Received blockchain invalid");
  }
};

const handleReceivedTransaction = (transaction: Transaction) => {
  addToTransactionPool(transaction, getUnspentTxOuts());
};

const hashMatchesDifficulty = (hash: string, difficulty: number): boolean => {
  const hashInBinary: string = hexToBinary(hash);
  const requiredPrefix: string = "0".repeat(difficulty);
  return hashInBinary.startsWith(requiredPrefix);
};

const hashMatchesBlockContent = (block: Block): boolean => {
  const blockHash: string = calculateHashForBlock(block);
  return blockHash === block.hash;
};

const findBlock = (
  index: number,
  previousHash: string,
  timestamp: number,
  data: Transaction[],
  difficulty: number
): Block => {
  let nonce = 0;
  while (true) {
    const hash: string = calculateHash(
      index,
      previousHash,
      timestamp,
      data,
      difficulty,
      nonce
    );
    if (hashMatchesDifficulty(hash, difficulty)) {
      return new Block(
        index,
        hash,
        previousHash,
        timestamp,
        data,
        difficulty,
        nonce
      );
    }
    nonce++;
  }
};

const getAccountBalance = (): number => {
  return getBalance(getPublicFromWallet(), getUnspentTxOuts());
};

const sendTransaction = (address: string, amount: number): Transaction => {
  const tx: Transaction = createTransaction(
    address,
    amount,
    getPrivateFromWallet(),
    getUnspentTxOuts(),
    getTransactionPool()
  );
  addToTransactionPool(tx, getUnspentTxOuts());
  broadCastTransactionPool();
  return tx;
};

const getDifficulty = (aBlockchain: Block[]): number => {
  const latestBlock: Block = aBlockchain[blockchain.length - 1]!;
  if (
    latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
    latestBlock.index !== 0
  ) {
    return getAdjustedDifficulty(latestBlock, aBlockchain);
  } else {
    return latestBlock.difficulty;
  }
};

const getAdjustedDifficulty = (latestBlock: Block, aBlockchain: Block[]) => {
  const prevAdjustmentBlock: Block = aBlockchain[
    blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL
  ]!;
  const timeExpected: number =
    BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
  const timeTaken: number =
    latestBlock.timestamp - prevAdjustmentBlock.timestamp;
  if (timeTaken < timeExpected / 2) {
    return prevAdjustmentBlock.difficulty + 1;
  } else if (timeTaken > timeExpected * 2) {
    return prevAdjustmentBlock.difficulty - 1;
  } else {
    return prevAdjustmentBlock.difficulty;
  }
};

const getAccumulatedDifficulty = (aBlockchain: Block[]): number => {
  return aBlockchain
    .map((block) => block.difficulty)
    .map((difficulty) => Math.pow(2, difficulty))
    .reduce((a, b) => a + b);
};

const isValidTimestamp = (newBlock: Block, previousBlock: Block): boolean => {
  return (
    previousBlock.timestamp - 60 < newBlock.timestamp &&
    newBlock.timestamp - 60 < getCurrentTimestamp()
  );
};

const hasValidHash = (block: Block): boolean => {
  if (!hashMatchesBlockContent(block)) {
    console.log("invalid hash, got: " + block.hash);
    return false;
  }

  if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
    console.log(
      `block difficulty not satisfied. Expected : ${block.difficulty}, got: ${block.hash}`
    );
    return false; //check this
  }
  return true;
};

const getCurrentTimestamp = (): number =>
  Math.round(new Date().getTime() / 1000);

const generateRawNextBlock = (blockData: Transaction[]) => {
  const previousBlock: Block = getLatestBlock();
  const difficulty: number = getDifficulty(getBlockchain());
  const nextIndex: number = previousBlock.index + 1;
  const nextTimestamp: number = getCurrentTimestamp();
  const newBlock: Block = findBlock(
    nextIndex,
    previousBlock.hash,
    nextTimestamp,
    blockData,
    difficulty
  );
  if (addBlockToChain(newBlock)) {
    broadcastLatest();
    return newBlock;
  } else {
    return null;
  }
};

const getMyUnspentTransactionOutputs = () => {
  return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
};

export {
  addBlockToChain,
  Block,
  getBlockchain,
  getLatestBlock,
  generateNextBlock,
  generateRawNextBlock,
  generatenextBlockWithTransactions,
  getAccountBalance,
  isValidBlockStructure,
  replaceChain,
  handleReceivedTransaction,
  sendTransaction,
  getUnspentTxOuts,
  getMyUnspentTransactionOutputs,
};
// hashMatchesDifficulty used 2 times
