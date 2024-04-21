// app.js

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Participants and Votes data
let votes = { option1: 0, option2: 0 };
let isPollOpen = true;
let votedParticipants = {};

// Serve HTML and static files
app.use(express.static(__dirname + '/public'));

// Handle socket connections
io.on('connection', (socket) => {
  const {participantId} = socket.handshake.query;

  console.log("User " + participantId + " connected");

  if (participantId == "null") {
    // If the participant doesn't have an ID, assign the socket ID
    console.log("Assigned a new Id to " + socket.id);
    io.to(socket.id).emit('set-cookie', { participantId: socket.id, hasVoted: false });
  } else if (participantId == "resultBoard"){
    io.to(socket.id).emit('update-votes', votes);
  } else {
    // If the participant has an ID, check if they have already voted
    const hasVoted = votedParticipants[participantId] || false;
    io.to(socket.id).emit('update-status', { participantId, isPollOpen, hasVoted });
  }

  // Handle participant voting
  socket.on('vote', ({ option, participantId, socketId }) => {
    console.log(participantId + " on socket " + socketId + " has voted for " + option);
    // Check if the participant has not voted before and if the poll is open
    if (!votedParticipants[participantId] && isPollOpen) {
        console.log("Vote registered");
      // Update votes and add participant to votedParticipants list
      votes[option]++;
      votedParticipants[participantId] = true;
      io.emit('update-votes', votes);
    } else {
      console.log("Vote ignored");
    }
  });

  // Handle vote reset
  socket.on('reset-votes', () => {
    // Reset votes and participants who have voted
    console.log("Votes reset");
    votes = { option1: 0, option2: 0 };
    votedParticipants = {};
    isPollOpen = true;

    // Broadcast the reset to all participants and result board
    io.emit('reset');
    io.emit('update-votes', votes);
  });

  // Handle open poll action
  socket.on('open-poll', () => {
    // Set the poll as open and broadcast the status to all participants
    isPollOpen = true;
  });

  // Handle close poll action
  socket.on('close-poll', () => {
    // Set the poll as closed and broadcast the status to all participants
    isPollOpen = false;
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the result page
app.get('/result', (req, res) => {
  res.sendFile(__dirname + '/public/result.html');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});