const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  path: "/guilde/socket.io/"
});

const fs = require('fs')
const custom = {
  log(text) {
    const date = new Date();
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth()+ 1)).slice(-2);
    const year = date.getFullYear();
    const hour = ('0' + (date.getHours())).slice(-2);
    const minute = ('0' + (date.getMinutes())).slice(-2);
    const second = ('0' + (date.getSeconds())).slice(-2);
    const formattedDate = '['+day+'-'+month+'-'+year+', '+hour+':'+minute+':'+second+'] ';
    fs.appendFile('server_logs.txt', formattedDate + text + '\n', (err) => {if (err) throw err;});
  }
}

custom.log("Program started");

// Participants and Votes data
let votes = { pour: 0, contre: 0, abstention:0 };
let isPollOpen = false;
let isResultShown = false;
let proposition = "";
let votedParticipants = {};
let connexionCount = 0;

// Serve HTML and static files
app.use(express.static(__dirname + '/public'));

// Handle socket connections
io.on('connection', (socket) => {
  const {participantId} = socket.handshake.query;

  custom.log("User " + participantId + " connected on socket " + socket.id);
  connexionCount++;
  io.emit('update-count', connexionCount);

  if (participantId == "null") {
    // If the participant doesn't have an ID, assign the socket ID
    custom.log("Assigned a new Id to " + socket.id);
    io.to(socket.id).emit('set-cookie', { participantId: socket.id, hasVoted: false });

    // Send status (If the vote is open and if this user has voted already)
    const hasVoted = votedParticipants[participantId] || false;
    io.to(socket.id).emit('update-status', {isPollOpen, isResultShown});
    io.to(socket.id).emit('update-user', hasVoted);

    // Send current proposition
    io.to(socket.id).emit('update-proposition', proposition);

  } else if (participantId == "adminPanel" || participantId == "resultBoard") {
    // Send current votes
    io.to(socket.id).emit('update-votes', votes);
    
    // Send current status
    io.to(socket.id).emit('update-status', {isPollOpen, isResultShown});

    // Send current proposition
    io.to(socket.id).emit('update-proposition', proposition);

    // Make sure it doesnt get added to the connexion count and update it
    connexionCount--;
    io.emit('update-count', connexionCount);

  } else {
    // If the participant has an ID, check if they have already voted
    const hasVoted = votedParticipants[participantId] || false;
    // Send them status, proposition and if they can vote
    io.to(socket.id).emit('update-status', {isPollOpen, isResultShown});
    io.to(socket.id).emit('update-user', hasVoted);
    io.to(socket.id).emit('update-proposition', proposition);
  }

  // Handle participant diconnecting
  socket.on('disconnect', (socket) => {
    if (participantId != "resultBoard" && participantId != "adminPanel") {
      connexionCount--;
    }
    io.emit('update-count', connexionCount);
    custom.log("User " + participantId + " disconnected on socket " + socket.id);
  });

  // Handle participant voting
  socket.on('vote', ({ option, participantId, socketId }) => {
    custom.log(participantId + " on socket " + socketId + " has voted for " + option);
    // Check if the participant has not voted before and if the poll is open
    if (!votedParticipants[participantId] && isPollOpen && option in votes) {
        custom.log("Vote registered");
      // Update votes and add participant to votedParticipants list
      votes[option]++;
      votedParticipants[participantId] = option;
      console.log(votedParticipants)
      io.emit('update-votes', votes);
    } else {
      custom.log("Vote ignored");
    }
  });

  // Handle vote change
  socket.on('change-vote', ({option, participantId, socketId}) => {
    custom.log(participantId + " on socket " + socketId + " has removed their vote for " + option);
    if (votedParticipants[participantId] && isPollOpen && option in votes) {
        custom.log("Removed vote registered");
      // Update votes and add participant to votedParticipants list
      let previousVote = votedParticipants[participantId];
      votes[previousVote]--;
      votedParticipants[participantId] = false;
      io.to(socketId).emit('reset');
      io.emit('update-votes', votes);
    } else {
      io.to(socketId).emit('reset');
    }
  });

  // Handle vote reset
  socket.on('reset-votes', () => {
    // Reset votes and participants who have voted
    custom.log("Votes reset");
    votes = { pour: 0, contre: 0, abstention:0 };
    votedParticipants = {};

    // Broadcast the reset to all participants and result board
    io.emit('reset');
    io.emit('update-votes', votes);
  });

  // Handle proposition set action
  socket.on('set-proposition', (newProposition) => {
    // Set the poll as open and broadcast the status to all participants
    proposition = newProposition;
    io.emit('update-proposition', proposition);
    custom.log("Proposition set to : " + proposition)
  });

  // Handle open poll action
  socket.on('open-poll', () => {
    // Set the poll as open and broadcast the status to all participants
    isPollOpen = true;
    io.emit('update-status', {isPollOpen, isResultShown});
    custom.log("Poll opened")
  });

  // Handle close poll action
  socket.on('close-poll', () => {
    // Set the poll as closed and broadcast the status to all participants
    isPollOpen = false;
    io.emit('update-status', {isPollOpen, isResultShown});
    custom.log("Poll closed")
  });

  // Handle close poll action
  socket.on('show-results', () => {
    // Set the poll as closed and broadcast the status to all participants
    isResultShown = true;
    io.emit('update-status', {isPollOpen, isResultShown});
    custom.log("Results displayed")
  });

  // Handle close poll action
  socket.on('hide-results', () => {
    // Set the poll as closed and broadcast the status to all participants
    isResultShown = false;
    io.emit('update-status', {isPollOpen, isResultShown});
    custom.log("Results hidden")
  });

});

// Serve the main page
app.get('/guilde', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the result page
app.get('/result', (req, res) => {
  res.sendFile(__dirname + '/public/results.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  custom.log(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  custom.log(`Server is running on http://localhost:${PORT}`);
});
