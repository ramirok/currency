"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceChain = exports.isValidBlockStructure = exports.getAccountBalance = exports.generatenextBlockWithTransactions = exports.generateRawNextBlock = exports.generateNextBlock = exports.getLatestBlock = exports.getBlockchain = exports.Block = exports.addBlockToChain = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const p2p_1 = require("./p2p");
const util_1 = require("./util");
const transactions_1 = require("./transactions");
const wallet_1 = require("./wallet");
const BLOCK_GENERATION_INTERVAL = 10;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;
class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}
exports.Block = Block;
const genesisBlock = new Block(0, "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7", null, 1465154705, [], 0, 0);
let blockchain = [genesisBlock];
let unspentTxOuts = [];
const getBlockchain = () => blockchain;
exports.getBlockchain = getBlockchain;
const getLatestBlock = () => blockchain[blockchain.length - 1];
exports.getLatestBlock = getLatestBlock;
const calculateHashForBlock = (block) => calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
const generateNextBlock = () => {
    const coinbaseTx = transactions_1.getCoinbaseTransaction(wallet_1.getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData = [coinbaseTx];
    return generateRawNextBlock(blockData);
};
exports.generateNextBlock = generateNextBlock;
const generatenextBlockWithTransactions = (receiverAddress, amount) => {
    if (!transactions_1.isValidAddress(receiverAddress)) {
        throw new Error("invalid address");
    }
    if (typeof amount !== "number") {
        throw new Error("invalid amount");
    }
    const coinbaseTx = transactions_1.getCoinbaseTransaction(wallet_1.getPublicFromWallet(), getLatestBlock().index + 1);
    const tx = wallet_1.createTransaction(receiverAddress, amount, wallet_1.getPrivateFromWallet(), unspentTxOuts);
    const blockData = [coinbaseTx, tx];
    return generateRawNextBlock(blockData);
};
exports.generatenextBlockWithTransactions = generatenextBlockWithTransactions;
const calculateHash = (index, previousHash, timestamp, data, difficulty, nonce) => crypto_js_1.default.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
const isValidBlockStructure = (block) => {
    return (typeof block.index === "number" &&
        typeof block.hash === "string" &&
        typeof block.previousHash === "string" &&
        typeof block.timestamp === "number" &&
        typeof block.data === "object");
};
exports.isValidBlockStructure = isValidBlockStructure;
const isValidNewBlock = (newBlock, previousBlock) => {
    if (!isValidBlockStructure(newBlock)) {
        console.log("invalid block structure");
        console.log(newBlock);
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log("invalid index");
        return false;
    }
    else if (previousBlock.hash !== newBlock.previousHash) {
        console.log("invalid previous hash");
        return false;
    }
    else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log("invalid timestamp");
        return false;
    }
    else if (!hasValidHash(newBlock)) {
        return false;
    }
    return true;
};
const isValidChain = (blockchainToValidate) => {
    const isValidGenesis = (block) => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }
    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }
    return true;
};
const addBlockToChain = (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal = transactions_1.processTransactions(newBlock.data, unspentTxOuts, newBlock.index);
        if (retVal === null) {
            return false;
        }
        else {
            blockchain.push(newBlock);
            unspentTxOuts = retVal;
            return true;
        }
    }
    return false;
};
exports.addBlockToChain = addBlockToChain;
const replaceChain = (newBlocks) => {
    if (isValidChain(newBlocks) &&
        getAccumulatedDifficulty(newBlocks) >
            getAccumulatedDifficulty(getBlockchain())) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        p2p_1.broadcastLatest();
    }
    else {
        console.log("Received blockchain invalid");
    }
};
exports.replaceChain = replaceChain;
const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = util_1.hexToBinary(hash);
    const requiredPrefix = "0".repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};
const hashMatchesBlockContent = (block) => {
    const blockHash = calculateHashForBlock(block);
    return blockHash === block.hash;
};
const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};
const getAccountBalance = () => {
    return wallet_1.getBalance(wallet_1.getPublicFromWallet(), unspentTxOuts);
};
exports.getAccountBalance = getAccountBalance;
const getDifficulty = (aBlockchain) => {
    const latestBlock = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 &&
        latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    }
    else {
        return latestBlock.difficulty;
    }
};
const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
    const prevAdjustmentBlock = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    }
    else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    }
    else {
        return prevAdjustmentBlock.difficulty;
    }
};
const getAccumulatedDifficulty = (aBlockchain) => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};
const isValidTimestamp = (newBlock, previousBlock) => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp &&
        newBlock.timestamp - 60 < getCurrentTimestamp());
};
const hasValidHash = (block) => {
    if (!hashMatchesBlockContent(block)) {
        console.log("invalid hash, got: " + block.hash);
        return false;
    }
    if (!hashMatchesDifficulty(block.hash, block.difficulty)) {
        console.log("block difficulty not satisfied. Expected : " +
            block.difficulty +
            " got: " +
            block.hash);
        return false; //check this
    }
    return true;
};
const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);
const generateRawNextBlock = (blockData) => {
    const previousBlock = getLatestBlock();
    const difficulty = getDifficulty(getBlockchain());
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = getCurrentTimestamp();
    const newBlock = findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    if (addBlockToChain(newBlock)) {
        p2p_1.broadcastLatest();
        return newBlock;
    }
    else {
        return null;
    }
};
exports.generateRawNextBlock = generateRawNextBlock;
// hashMatchesDifficulty used 2 times
