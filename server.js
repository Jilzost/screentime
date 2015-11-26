/*jslint node:true */
'use strict';

var http = require("http");
var url = require("url");
var querystring = require('querystring');
var logger = require('./logger');
var socketServer = require('./socketServer');


function start(route, handle) {
    var server;
    function onRequest(request, response) {
        var postData,
            pathname,
            id;
        try {
            postData = '';
            pathname = url.parse(request.url).pathname;
            id = querystring.parse(url.parse(request.url).query).id;
            request.setEncoding("utf8");

            request.addListener("data", function (postDataChunk) {
                postData += postDataChunk;
            });

            request.addListener("end", function () {
                route(handle, pathname, id, response, postData);
            });
        } catch (err) {
            logger.log('server', id, 1,
                'server.start.onRequest', 'Failed: ' + err);
        }
    }
    server = http.createServer(onRequest).listen(3000);
    console.log('Server is listening on port 3000.');
    logger.log('server', 'server', 5, 'server.start', 'Server started');
    socketServer.listen(server);
}

exports.start = start;