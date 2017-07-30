/*jslint node:true */
'use strict';

var http = require("http");
var url = require("url");
var querystring = require('querystring');
var logger = require('./logger');
var socketServer = require('./socketServer');
var config = require('config');

function start(route, handle) {
    var server, port;
    function onRequest(request, response) {
        var postData,
            pathname,
            options;
        try {
            postData = '';
            pathname = url.parse(request.url).pathname;
            options = querystring.parse(url.parse(request.url).query);

            request.setEncoding("utf8");

            request.addListener("data", function (postDataChunk) {
                postData += postDataChunk;
            });

            request.addListener("end", function () {
                route(handle, pathname, options, response, postData);
            });
        } catch (err) {
            logger.log('server', options.id, 1,
                'server.start.onRequest', 'Failed: ' + err);
        }
    }
    port = (process.env.PORT || config.get('port'));
    server = http.createServer(onRequest).listen(port);
    console.log('Server is listening on port ' + port + '.');
    logger.log('server', 'server', 4, 'server.start',
        'Server started, configuration ' + config.get('configFilename'));
    //logger.log('server', 'server', 4, 'server.start', 'NODE_ENV: ' + config.util.getEnv('NODE_ENV'));
    //logger.log('server', 'server', 4, 'server.start', 'NODE_CONFIG_DIR: ' + config.util.getEnv('NODE_CONFIG_DIR'));
    //logger.log('server', 'server', 4, 'server.start', 'NODE_CONFIG: ' + config.util.getEnv('NODE_CONFIG'));
    //logger.log('server', 'server', 4, 'server.start', 'HOSTNAME: ' + config.util.getEnv('HOSTNAME'));
    //logger.log('server', 'server', 4, 'server.start', 'NODE_APP_INSTANCE: ' + config.util.getEnv('NODE_APP_INSTANCE'));
    socketServer.listen(server);
}

exports.start = start;
