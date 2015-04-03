/*jslint node:true */
'use strict';

var http = require('http');
var logger = require('./logger');

var lastbeats = {};

function checkHeartbeat(beat) {

    if (beat.serverTime === lastbeats[beat.signId].serverTime) {
        logger.log('server', beat.signId, 2, 'checkHeartbeat',
            'No heartbeat (uptime was ' +
                logger.formatDuration(lastbeats[beat.signId].uptime) + ')');
        lastbeats[beat.signId].up = false;
    }
}

function heartbeat(pathname, id, response, postData) {
    try {
        var beat = JSON.parse(postData);

        beat.serverTime = Date.now();
        beat.up = true;

        if (!lastbeats.hasOwnProperty(beat.signId)) {
            if (beat.uptime < 1000) {
                logger.log('server', beat.signId, 5, 'checkHeartbeat',
                    'New sign activated', true);
            } else {
                logger.log('server', beat.signId, 5, 'checkHeartbeat',
                    'First heartbeat from existing sign');
            }
        } else if (lastbeats[beat.signId].serverTime +
                lastbeats[beat.signId].heartbeatRate < Date.now()) {
            logger.log('server', beat.signId, 5, 'checkHeartbeat',
                'Sign is back online', true);
        } else if (lastbeats[beat.signId].uptime > beat.uptime) {
            logger.log('server', beat.signId, 2, 'checkHeartbeat',
                'Sign has reset (uptime was '
                    + logger.formatDuration(lastbeats[beat.signId].uptime)
                    + ')', true);
        }

        lastbeats[beat.signId] = beat;

        setTimeout(function () {checkHeartbeat(beat); }, beat.heartbeatRate);

        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write('ok');

        response.end();
    } catch (err) {
        logger.log('server', 'server', 3,
            'heartbeatHandlers.heartbeat', 'Failed: ' + err);
    }
}

function getUptimes(maximumDowntime) {
    var i, times = [];
    try {
        maximumDowntime = maximumDowntime || 0;
        for (i in lastbeats) {
            if (lastbeats.hasOwnProperty(i)) {
                if (lastbeats[i].up) {
                    times.push({
                        sign: lastbeats[i].signId,
                        up: true,
                        time: lastbeats[i].uptime
                    });
                } else if (maximumDowntime === 0 ||
                        new Date() - lastbeats[i].timestamp < maximumDowntime) {
                    times.push({
                        sign: lastbeats[i].signId,
                        up: false,
                        time: Date.now() - lastbeats[i].timestamp
                    });
                }
            }
        }
        times.sort(function (a, b) {
            if (a.signId < b.signId) {return -1; }
            if (a.signId > b.signId) {return 1; }
            return 0;
        });
        return times;
    } catch (err) {
        logger.log('server', 'server', 2,
            'heartbeatHandlers.getUptimes', 'Failed: ' + err);
        return [];
    }
}

exports.heartbeat = heartbeat;
exports.getUptimes = getUptimes;
