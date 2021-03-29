"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyUnspentTransactionOutputs = exports.getUnspentTxOuts = exports.sendTransaction = exports.handleReceivedTransaction = exports.replaceChain = exports.isValidBlockStructure = exports.getAccountBalance = exports.generatenextBlockWithTransactions = exports.generateRawNextBlock = exports.generateNextBlock = exports.getLatestBlock = exports.getBlockchain = exports.Block = exports.addBlockToChain = void 0;
const crypto_js_1 = __importDefault(require("crypto-js"));
const p2p_1 = require("./p2p");
const util_1 = require("./util");
const transactions_1 = require("./transactions");
const wallet_1 = require("./wallet");
const transactionPool_1 = require("./transactionPool");
const lodash_1 = __importDefault(require("lodash"));
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
const genesisTransaction = {
    txIns: [{ signature: "", txOutId: "", txOutIndex: 0 }],
    txOuts: [
        {
            address: "04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a",
            amount: 50,
        },
    ],
    id: "e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3",
};
const genesisBlock = new Block(0, "91a73664bc84c0baa1fc75ea6e4aa6d1d20c5df664c724e3159aefc2e1186627", "", 1465154705, [genesisTransaction], 0, 0);
let blockchain = [genesisBlock];
let unspentTxOuts = transactions_1.processTransactions(blockchain[0]?.data, [], 0) || [];
const getBlockchain = () => blockchain;
exports.getBlockchain = getBlockchain;
const getUnspentTxOuts = () => lodash_1.default.cloneDeep(unspentTxOuts);
exports.getUnspentTxOuts = getUnspentTxOuts;
const getLatestBlock = () => blockchain[blockchain.length - 1];
exports.getLatestBlock = getLatestBlock;
const setUnspentTxOuts = (newUnspentTxOut) => {
    console.log(`replacing unspentTxouts with: ${newUnspentTxOut}`);
    unspentTxOuts = newUnspentTxOut;
};
const calculateHashForBlock = (block) => calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
const generateNextBlock = () => {
    const coinbaseTx = transactions_1.getCoinbaseTransaction(wallet_1.getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData = [coinbaseTx].concat(transactionPool_1.getTransactionPool());
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
    const tx = wallet_1.createTransaction(receiverAddress, amount, wallet_1.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool_1.getTransactionPool());
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
        console.log(`invalid block structure: ${JSON.stringify(newBlock)}`);
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
    console.log("isValidChain:");
    console.log(JSON.stringify(blockchainToValidate));
    const isValidGenesis = (block) => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
        return null;
    }
    // validate each block in the chain. The block is valid if the block structure is valid and the transaction are valid
    let aUnspentTxOuts = [];
    for (let i = 0; i < blockchainToValidate.length; i++) {
        const currentBlock = blockchainToValidate[i];
        if (i !== 0 &&
            !isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }
        aUnspentTxOuts = transactions_1.processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
        if (aUnspentTxOuts === null) {
            console.log("invalid transactions in blockchain");
            return null;
        }
    }
    return aUnspentTxOuts;
};
const addBlockToChain = (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal = transactions_1.processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log("block is not valid in terms of transactions");
            return false;
        }
        else {
            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            transactionPool_1.updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
    return false;
};
exports.addBlockToChain = addBlockToChain;
const replaceChain = (newBlocks) => {
    const aUnspentTxOuts = isValidChain(newBlocks);
    const validChain = aUnspentTxOuts !== null;
    if (validChain &&
        getAccumulatedDifficulty(newBlocks) >
            getAccumulatedDifficulty(getBlockchain())) {
        console.log("Received blockchain is valid. Replacing current blockchain with received blockchain");
        blockchain = newBlocks;
        setUnspentTxOuts(aUnspentTxOuts);
        transactionPool_1.updateTransactionPool(unspentTxOuts);
        p2p_1.broadcastLatest();
    }
    else {
        console.log("Received blockchain invalid");
    }
};
exports.replaceChain = replaceChain;
const handleReceivedTransaction = (transaction) => {
    transactionPool_1.addToTransactionPool(transaction, getUnspentTxOuts());
};
exports.handleReceivedTransaction = handleReceivedTransaction;
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
    return wallet_1.getBalance(wallet_1.getPublicFromWallet(), getUnspentTxOuts());
};
exports.getAccountBalance = getAccountBalance;
const sendTransaction = (address, amount) => {
    const tx = wallet_1.createTransaction(address, amount, wallet_1.getPrivateFromWallet(), getUnspentTxOuts(), transactionPool_1.getTransactionPool());
    transactionPool_1.addToTransactionPool(tx, getUnspentTxOuts());
    p2p_1.broadCastTransactionPool();
    return tx;
};
exports.sendTransaction = sendTransaction;
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
        console.log(`block difficulty not satisfied. Expected : ${block.difficulty}, got: ${block.hash}`);
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
const getMyUnspentTransactionOutputs = () => {
    return wallet_1.findUnspentTxOuts(wallet_1.getPublicFromWallet(), getUnspentTxOuts());
};
exports.getMyUnspentTransactionOutputs = getMyUnspentTransactionOutputs;
// hashMatchesDifficulty used 2 times
