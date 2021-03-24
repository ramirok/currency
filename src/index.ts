import express from "express";

import { Block, generateNextBlock, getBlockchain } from "./blockchain";
import { connectToPeers, getSockets, initP2PServer } from "./p2p";

const httpPort: number = parseInt(process.env.HTTP_PORT as string) || 3001;
const p2pPort: number = parseInt(process.env.P2P_PORT as string) || 6001;

const initHttpServer = (myHttpPort: number) => {
  const app = express();
  app.use(express.json());

  app.get("/blocks", (_req, res) => {
    res.send(getBlockchain());
  });

  app.post("/mineBlock", (req, res) => {
    const newBlock: Block = generateNextBlock(req.body.data);
    res.send(newBlock);
  });

  app.get("/peers", (_req, res) => {
    res.send(
      getSockets().map(
        (s: any) => `${s._socket.remoteAddress}:${s.socket.remotePort}`
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
