import _ from "lodash";
import {
  Transaction,
  TxIn,
  UnspentTxOut,
  validateTransaction,
} from "./transactions";

let transactionPool: Transaction[] = [];

const getTransactionPool = () => {
  return _.cloneDeep(transactionPool);
};

const addToTransactionPool = (
  tx: Transaction,
  unspentTxOuts: UnspentTxOut[]
) => {
  if (!validateTransaction(tx, unspentTxOuts)) {
    throw new Error("Trying to add invalid tx to pool");
  }

  if (!isValidTxForPool(tx, transactionPool)) {
    throw new Error("Trying to add invalid tx to pool");
  }

  console.log(`adding to txPool ${JSON.stringify(tx)}`);
  transactionPool.push(tx);
};

const hasTxIn = (txIn: TxIn, unspentTxOuts: UnspentTxOut[]): boolean => {
  const foundTxIn = unspentTxOuts.find((uTxO: UnspentTxOut) => {
    return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
  });

  return foundTxIn !== undefined;
};

const isValidTxForPool = (
  tx: Transaction,
  aTransactionPool: Transaction[]
): boolean => {
  const txPoolIns: TxIn[] = getTxPoolIns(aTransactionPool);

  const containsTxIn = (_txIns: TxIn[], txIn: TxIn) => {
    return _.find(txPoolIns, (txPoolIn) => {
      return (
        txIn.txOutIndex === txPoolIn.txOutIndex &&
        txIn.txOutId === txPoolIn.txOutId
      );
    });
  };
  for (const txIn of tx.txIns) {
    if (containsTxIn(txPoolIns, txIn)) {
      console.log("txIn already found in the txPool");
      return false;
    }
  }
  return true;
};

const updateTransactionPool = (unspentTxOuts: UnspentTxOut[]) => {
  const invalidTxs = [];
  for (const tx of transactionPool) {
    for (const txIn of tx.txIns) {
      if (!hasTxIn(txIn, unspentTxOuts)) {
        invalidTxs.push(tx);
        break;
      }
    }
  }
  if (invalidTxs.length > 0) {
    console.log(
      `removing the following transactions from txPool: ${JSON.stringify(
        invalidTxs
      )}`
    );
    transactionPool = _.without(transactionPool, ...invalidTxs);
  }
};

const getTxPoolIns = (aTransactionPool: Transaction[]): TxIn[] => {
  return _(aTransactionPool)
    .map((tx) => tx.txIns)
    .flatten()
    .value();
};

export { addToTransactionPool, getTransactionPool, updateTransactionPool };
