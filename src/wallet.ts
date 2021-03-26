import { existsSync, readFileSync, writeFileSync } from "fs";
import * as ecdsa from "elliptic";
import _ from "lodash";
import {
  getPublicKey,
  getTransactionId,
  signTxIn,
  Transaction,
  TxIn,
  TxOut,
  UnspentTxOut,
} from "./transactions";

const ec = new ecdsa.ec("secp256k1");
const privateKeyLocation = "node/wallet/private_key";

const generatePrivateKey = (): string => {
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const getPrivateFromWallet = (): string => {
  const buffer = readFileSync(privateKeyLocation, "utf-8");
  return buffer.toString();
};

const getPublicFromWallet = (): string => {
  const privateKey = getPrivateFromWallet();
  const key = ec.keyFromPrivate(privateKey, "hex");
  return key.getPublic().encode("hex", false);
};

const initWallet = () => {
  // not override existing private key
  if (existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivateKey();
  writeFileSync(privateKeyLocation, newPrivateKey);
  console.log("new wallet with private key created");
};

const getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
  return _(unspentTxOuts)
    .filter((uTxO: UnspentTxOut) => uTxO.address === address)
    .map((uTxO: UnspentTxOut) => uTxO.amount)
    .sum();
};

const findTxOutsForAmount = (
  amount: number,
  myUnspentTxOuts: UnspentTxOut[]
) => {
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

const createTxOuts = (
  receiverAddress: string,
  myAddress: string,
  amount: number,
  leftOverAmount: number
) => {
  const txOut1: TxOut = new TxOut(receiverAddress, amount);
  if (leftOverAmount === 0) {
    return [txOut1];
  } else {
    const leftOverTx = new TxOut(myAddress, leftOverAmount);
    return [txOut1, leftOverTx];
  }
};

const createTransaction = (
  receiverAddress: string,
  amount: number,
  privateKey: string,
  unspentTxOuts: UnspentTxOut[]
): Transaction => {
  const myAddress: string = getPublicKey(privateKey);
  const myUnspentTxOuts = unspentTxOuts.filter(
    (uTxO: UnspentTxOut) => uTxO.address === myAddress
  );

  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(
    amount,
    myUnspentTxOuts
  );

  const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
    const txIn: TxIn = new TxIn();
    txIn.txOutId = unspentTxOut.txOutId;
    txIn.txOutIndex = unspentTxOut.txOutIndex;
    return txIn;
  };

  const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn);

  const tx: Transaction = new Transaction();
  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  tx.id = getTransactionId(tx);

  tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
    txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });
  return tx;
};

export {
  createTransaction,
  getPublicFromWallet,
  getPrivateFromWallet,
  getBalance,
  generatePrivateKey,
  initWallet,
};
