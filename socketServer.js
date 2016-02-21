'use strict';

var socketio = require('socket.io');

var io;
var signNumber = 1;
var signNames = {};
var namesUsed = [];
var currentChannel = {};
var lastButtonpress = {};

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
}

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
        handleSpeakBroadcasting(socket, signNames);
        handleChannelJoining(socket);
        socket.on('channels', function () {
            socket.emit('channels', io.sockets.manager.channels);
        });
        handleClientDisconnection(socket, signNames, namesUsed);
    });
}

function speak(path, id, response) {
    if (!lastButtonpress[id] || lastButtonpress[id] + 1000 < Date.now()) {
        lastButtonpress[id] = Date.now();
        console.log('speech triggered for ' + path);
        io.sockets.in(id).emit('speak');
    } else {
        console.log('Additional buttonpress ignored for ' + path);
    }
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.write('Error 404: resource not found.');
    response.end();
}


exports.listen = listen;
exports.speak = speak;
