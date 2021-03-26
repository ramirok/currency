"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initWallet = exports.generatePrivateKey = exports.getBalance = exports.getPrivateFromWallet = exports.getPublicFromWallet = exports.createTransaction = void 0;
const fs_1 = require("fs");
const ecdsa = __importStar(require("elliptic"));
const lodash_1 = __importDefault(require("lodash"));
const transactions_1 = require("./transactions");
const ec = new ecdsa.ec("secp256k1");
const privateKeyLocation = "node/wallet/private_key";
const generatePrivateKey = () => {
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate();
    return privateKey.toString(16);
};
exports.generatePrivateKey = generatePrivateKey;
const getPrivateFromWallet = () => {
    const buffer = fs_1.readFileSync(privateKeyLocation, "utf-8");
    return buffer.toString();
};
exports.getPrivateFromWallet = getPrivateFromWallet;
const getPublicFromWallet = () => {
    const privateKey = getPrivateFromWallet();
    const key = ec.keyFromPrivate(privateKey, "hex");
    return key.getPublic().encode("hex", false);
};
exports.getPublicFromWallet = getPublicFromWallet;
const initWallet = () => {
    // not override existing private key
    if (fs_1.existsSync(privateKeyLocation)) {
        return;
    }
    const newPrivateKey = generatePrivateKey();
    fs_1.writeFileSync(privateKeyLocation, newPrivateKey);
    console.log("new wallet with private key created");
};
exports.initWallet = initWallet;
const getBalance = (address, unspentTxOuts) => {
    return lodash_1.default(unspentTxOuts)
        .filter((uTxO) => uTxO.address === address)
        .map((uTxO) => uTxO.amount)
        .sum();
};
exports.getBalance = getBalance;
const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
    let currentAmount = 0;
    const includedUnspentTxOuts = [];
    for (const myUnspentTxOut of myUnspentTxOuts) {
        includedUnspentTxOuts.push(myUnspentTxOut);
        currentAmount = currentAmount + myUnspentTxOut.amount;
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount;
            return { includedUnspentTxOuts, leftOverAmount };
        }
    }
    throw new Error("not enough coins to send transaction");
};
const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
    const txOut1 = new transactions_1.TxOut(receiverAddress, amount);
    if (leftOverAmount === 0) {
        return [txOut1];
    }
    else {
        const leftOverTx = new transactions_1.TxOut(myAddress, leftOverAmount);
        return [txOut1, leftOverTx];
    }
};
const createTransaction = (receiverAddress, amount, privateKey, unspentTxOuts) => {
    const myAddress = transactions_1.getPublicKey(privateKey);
    const myUnspentTxOuts = unspentTxOuts.filter((uTxO) => uTxO.address === myAddress);
    const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);
    const toUnsignedTxIn = (unspentTxOut) => {
        const txIn = new transactions_1.TxIn();
        txIn.txOutId = unspentTxOut.txOutId;
        txIn.txOutIndex = unspentTxOut.txOutIndex;
        return txIn;
    };
    const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);
    const tx = new transactions_1.Transaction();
    tx.txIns = unsignedTxIns;
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
    tx.id = transactions_1.getTransactionId(tx);
    tx.txIns = tx.txIns.map((txIn, index) => {
        txIn.signature = transactions_1.signTxIn(tx, index, privateKey, unspentTxOuts);
        return txIn;
    });
    return tx;
};
exports.createTransaction = createTransaction;
