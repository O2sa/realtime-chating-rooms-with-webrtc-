const fs = require("fs");
const express = require("express");
const https = require("https");
const cors = require("cors");

const PORT = 8080;
const main = express();

// HTTPS credentials
let privateKey = fs.readFileSync("server.key");
let certificate = fs.readFileSync("server.cert");
const credentials = { key: privateKey, cert: certificate };
const server = https.createServer(credentials, main);

// CORS setup for Express
main.use(
  cors({
    origin: "*", // Temporarily allow all origins    methods: ['GET', 'POST'],
    // credentials: true
  })
);

// Socket.IO setup with CORS
const io = require("socket.io")(server, {
  cors: {
    origin: "*", // Temporarily allow all origins
    methods: ["GET", "POST"],
    // credentials: true
  },
});

server.listen(PORT, null, function () {
  console.log("Listening on port " + PORT);
});

main.get("/", function (req, res) {
  res.sendFile(__dirname + "/client.html");
});

// Socket.IO connection handling
io.sockets.on("connection", function (socket) {
  socket.channels = {};
  sockets[socket.id] = socket;

  console.log("[" + socket.id + "] connection accepted");
  socket.on("disconnect", function () {
    for (var channel in socket.channels) {
      part(channel);
    }
    console.log("[" + socket.id + "] disconnected");
    delete sockets[socket.id];
  });

  socket.on("join", function (config) {
    console.log("[" + socket.id + "] join ", config);
    var channel = config.channel;
    var userdata = config.userdata;

    if (channel in socket.channels) {
      console.log("[" + socket.id + "] ERROR: already joined ", channel);
      return;
    }

    if (!(channel in channels)) {
      channels[channel] = {};
    }

    for (id in channels[channel]) {
      channels[channel][id].emit("addPeer", {
        peer_id: socket.id,
        should_create_offer: false,
      });
      socket.emit("addPeer", { peer_id: id, should_create_offer: true });
    }

    channels[channel][socket.id] = socket;
    socket.channels[channel] = channel;
  });

  function part(channel) {
    console.log("[" + socket.id + "] part ");

    if (!(channel in socket.channels)) {
      console.log("[" + socket.id + "] ERROR: not in ", channel);
      return;
    }

    delete socket.channels[channel];
    delete channels[channel][socket.id];

    for (id in channels[channel]) {
      channels[channel][id].emit("removePeer", { peer_id: socket.id });
      socket.emit("removePeer", { peer_id: id });
    }
  }

  socket.on("part", part);

  socket.on("relayICECandidate", function (config) {
    var peer_id = config.peer_id;
    var ice_candidate = config.ice_candidate;
    console.log(
      "[" + socket.id + "] relaying ICE candidate to [" + peer_id + "] ",
      ice_candidate
    );

    if (peer_id in sockets) {
      sockets[peer_id].emit("iceCandidate", {
        peer_id: socket.id,
        ice_candidate: ice_candidate,
      });
    }
  });

  socket.on("relaySessionDescription", function (config) {
    var peer_id = config.peer_id;
    var session_description = config.session_description;
    console.log(
      "[" + socket.id + "] relaying session description to [" + peer_id + "] ",
      session_description
    );

    if (peer_id in sockets) {
      sockets[peer_id].emit("sessionDescription", {
        peer_id: socket.id,
        session_description: session_description,
      });
    }
  });
});
