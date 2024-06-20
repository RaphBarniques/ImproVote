// app.js

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
let votes = { option1: 0, option2: 0 };
let options = { option1: "Option 1", option2: "Option 2" };
let isPollOpen = true;
let matchEnded = false;
let nextDate;
let nextTeam1;
let nextTeam2;
let votedParticipants = {};
let connectionCount = 0;
let savedStats = [];

// Serve HTML and static files
app.use(express.static(__dirname + '/public'));

// Handle socket connections
io.on('connection', (socket) => {
  const {participantId} = socket.handshake.query;

  custom.log("User " + participantId + " connected on socket " + socket.id);
  connectionCount++;
  io.emit('update-count', connectionCount);

  if (participantId == "null") {
    // If the participant doesn't have an ID, assign the socket ID
    custom.log("Assigned a new Id to " + socket.id);
    io.to(socket.id).emit('set-cookie', { participantId: socket.id, hasVoted: false });
    io.to(socket.id).emit('update-options', options);
    const hasVoted = votedParticipants[participantId] || false;
    io.to(socket.id).emit('update-status', { participantId, isPollOpen, hasVoted});
  } else if (participantId == "resultBoard"){
    io.to(socket.id).emit('update-votes', votes);
    io.to(socket.id).emit('update-options', options);
    io.to(socket.id).emit('update-stats', savedStats);
    connectionCount--;
    io.emit('update-count', connectionCount);
  } else {
    // If the participant has an ID, check if they have already voted
    const hasVoted = votedParticipants[participantId] || false;
    io.to(socket.id).emit('update-status', { participantId, isPollOpen, hasVoted});
    io.to(socket.id).emit('update-options', options);
  }

  if (matchEnded == true) {
    io.emit('display-next', nextDate, nextTeam1, nextTeam2);
  }


  // Handle participant voting
  socket.on('vote', ({ option, participantId, socketId }) => {
    custom.log(participantId + " on socket " + socketId + " has voted for " + option);
    // Check if the participant has not voted before and if the poll is open
    if (!votedParticipants[participantId] && isPollOpen && option in options) {
        custom.log("Vote registered");
      // Update votes and add participant to votedParticipants list
      votes[option]++;
      votedParticipants[participantId] = true;
      io.emit('update-votes', votes);
    } else {
      custom.log("Vote ignored");
    }
  });

  socket.on('disconnect', (socket) => {
    if (participantId != "resultBoard") {
      connectionCount--;
    }
    io.emit('update-count', connectionCount);
    custom.log("User " + participantId + " disconnected on socket " + socket.id);
  });

  // Handle vote reset
  socket.on('reset-votes', () => {
    // Reset votes and participants who have voted
    custom.log("Votes reset");
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
    matchEnded = false;
    custom.log("Poll opened")
  });

  // Handle close poll action
  socket.on('close-poll', () => {
    // Set the poll as closed and broadcast the status to all participants
    isPollOpen = false;
    custom.log("Poll closed")
  });

  // Handle displaying next week action
  socket.on('set-display-next', (date, team1, team2) => {
    // Set the poll as closed and broadcast the status to all participants
    isPollOpen = false;
    matchEnded = true;
    nextDate = date;
    nextTeam1 = team1;
    nextTeam2 = team2;
    io.emit('display-next', date, team1, team2);
    custom.log("Display was set for next match (" + team1 + ", " + team2 + ")")
  });

  // Handle option changes
  socket.on('change-options', (option) => {
    // Change the vote options
    options.option1 = option.option1;
    options.option2 = option.option2;

    // Broadcast to all participants and result board
    io.emit('update-options', options);
    custom.log("Options set for " + option.option1 + ", " + option.option2)
  });

  socket.on('set-stats', (currentStats) => {
    savedStats = currentStats;
    io.emit('update-stats', savedStats);
  });

});

// Serve the main page
app.get('/guilde', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the result page
app.get('/result', (req, res) => {
  res.sendFile(__dirname + '/public/result.html');
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
