/*jslint node:true */
'use strict';

var http = require('http');
var logger = require('./logger');

function receiveLog(pathname, id, response, postData) {
    var entry;
    id = id.id;
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write('ok');
    response.end();

    entry = JSON.parse(postData);

    logger.log(entry.source, entry.sign, entry.logLevel, entry.process,
        entry.message, false, new Date(entry.sourceTime));
}

exports.receiveLog = receiveLog;
