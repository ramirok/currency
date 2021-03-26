import express from "express";
import {
  generateNextBlock,
  getBlockchain,
  generateRawNextBlock,
  getAccountBalance,
  generatenextBlockWithTransactions,
} from "./blockchain";
import { connectToPeers, getSockets, initP2PServer } from "./p2p";
import { initWallet } from "./wallet";

const httpPort: number = parseInt(process.env.HTTP_PORT as string) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT as string) || 6001;

const initHttpServer = (myHttpPort: number) => {
  const app = express();
  app.use(express.json());

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err) {
        res.status(400).send(err.message);
      }
    }
  );

  app.get("/blocks", (_req, res) => {
    res.send(getBlockchain());
  });

  app.post("/mineRawBlock", (req, res) => {
    if (req.body.data == null) {
      res.send("data parameter is missing");
      return;
    }
    const newBlock = generateRawNextBlock(req.body.data);
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.post("/mineBlock", (_req, res) => {
    const newBlock = generateNextBlock();
    if (newBlock === null) {
      res.status(400).send("could not generate block");
    } else {
      res.send(newBlock);
    }
  });

  app.get("/balance", (_req, res) => {
    const balance: number = getAccountBalance();
    res.send({ balance });
  });

  app.post("/mineTransaction", (req, res) => {
    const address = req.body.address;
    const amount = req.body.amount;
    try {
      const resp = generatenextBlockWithTransactions(address, amount);
      res.send(resp);
    } catch (e) {
      console.log(e.message);
      res.status(400).send(e.message);
    }
  });

  app.get("/peers", (_req, res) => {
    res.send(
      getSockets().map(
        (s: any) => `${s._socket.remoteAddress}:${s._socket.remotePort}`
      )
    );
  });

  app.post("/addPeer", (req, res) => {
    connectToPeers(req.body.peer);
    res.send();
  });

  app.listen(myHttpPort, () => {
    console.log("Listening http on port: " + myHttpPort);
  });
};

initHttpServer(httpPort);
initP2PServer(p2pPort);
initWallet();
