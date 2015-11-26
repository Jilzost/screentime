'use strict';

var socketio = require('socket.io');

var io;
var signNumber = 1;
var signNames = {};
var namesUsed = [];
var currentChannel = {};

function assignSignName(socket, signNumber, signNames, namesUsed) {
    var name = 'Sign' + signNumber;
    signNames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return signNumber + 1;
}

function joinChannel(socket, channel) {
    console.log('joinChannel ' + channel);
    socket.join(channel);
    currentChannel[socket.id] = channel;
    socket.emit('joinResult', {channel: channel});
    io.sockets.in(channel).emit('message', {
        text: 'channel has been joined '
    });
    // var usersInChannel = io.sockets.clients(channel);
    // if (usersInChannel.length > 1) {
    //     var usersInChannelSummary = 'Users currently in ' + channel + ': ';
    //     for (var index in usersInRoom) {
    //         var userSocketId = usersInRoom[index].id;
    //         if (userSocketId != socket.id) {
    //             if (index > 0) {
    //                 usersInRoomSummary += ', ';
    //             }
    //             usersInRoomSummary += nickNames[userSocketId];
    //         }
    //     }
    //     usersInRoomSummary += '.';
    //     socket.emit('message', {text: usersInRoomSummary});
    // } 
}


// function handleMessageBroadcasting(socket) {
//     socket.on('message', function (message) {
//         console.log("handleMessageBroadcasting " + message);
//         socket.broadcast.to(message.channel).emit('message', {
//             text: message.text
//         });
//     });
// }

function handleSpeakBroadcasting(socket) {
    socket.on('speak', function (message) {
        io.sockets.in(message.channel).emit('speak');
    });
}

function handleChannelJoining(socket) {
    socket.on('join', function (channel) {
        socket.leave(currentChannel[socket.id]);
        joinChannel(socket, channel.newChannel);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(signNames[socket.id]);
        delete namesUsed[nameIndex];
        delete signNames[socket.id];
    });
}

function listen(server) {
    io = socketio.listen(server);
    // io.set('log level', 1);
    io.sockets.on('connection', function (socket) {
        signNumber = assignSignName(socket, signNumber, signNames, namesUsed);
        joinChannel(socket, 'Lobby');
        // handleMessageBroadcasting(socket, signNames);
        handleSpeakBroadcasting(socket, signNames);
        // handleNameChangeAttempts(socket, signNames, namesUsed);
        handleChannelJoining(socket);
        socket.on('channels', function () {
            socket.emit('channels', io.sockets.manager.channels);
        });
        handleClientDisconnection(socket, signNames, namesUsed);
    });
}

function speak(path, id, response) {
    console.log('speech triggered for ' + path);
    io.sockets.in(id).emit('speak');
    // var i;
    // for (i = 0; i < allSockets.length; i += 1) {
    //     console.log('emitting');
    //     console.log(allSockets[i]);
    //     allSockets[i].broadcast.to(id).emit('speak', {});
        // allSockets[i].broadcast.emit('speak');
    // }
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.write('Error 404: resource not found.');
    response.end();
}


exports.listen = listen;
exports.speak = speak;
