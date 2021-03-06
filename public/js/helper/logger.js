/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/logger.js
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var logger = {};

    logger.log = function (sourceFunctionName, message) {
        var unsent, entry, signId, url, regex;
        signId = logger.signId;

        try {
            if (!signId) {
              // Courtesy http://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
                url = window.location.href;
                regex = new RegExp("[?&]" + "id" + "(=([^&#]*)|&|#|$)");
                signId = regex.exec(url);
                if (!signId) {
                    signId = 'Unknown';
                } else if (!signId[2]) {
                    signId = 'Unknown';
                } else {
                   signId = decodeURIComponent(signId[2].replace(/\+/g, " "));
                }
            }

            logger.entriesCounted = logger.entriesCounted || 0;
            //Are we sure we haven't sent too many entries recently?
            if (logger.entriesCounted < 120) {
                logger.entriesCounted += 1;
                entry = {
                    logTime: new Date(),
                    sourceTime: new Date(),
                    source: 'sign',
                    sign: signId,
                    logLevel: 3,
                    process: sourceFunctionName,
                    message: message
                };
                $.post('postlog', JSON.stringify(entry));
                logger.countingEntriesSince = logger.countingEntriesSince
                    || Date.now();
            //We've sent too many entries; are we sure it's not time
            //to start sending again?
            } else if (logger.countingEntriesSince + 1200000 > Date.now()) {
                logger.unsentEntries = logger.unsentEntries || 0;
                logger.unsentEntries += 1;
            //resume sending log entries.
            } else {
                logger.countingEntriesSince = Date.now();
                logger.entriesCounted = 0;
                if (logger.unsentEntries > 0) {
                    unsent = logger.unsentEntries;
                    entry = {
                        logTime: new Date(),
                        source: 'sign',
                        sign: signId,
                        logLevel: 3,
                        process: 'logger',
                        message: unsent + ' messages unsent due to overflow'
                    };
                    $.post('postlog', JSON.stringify(entry));
                    logger.unsentEntries = 0;
                }
            }
        } catch (err) {
            console.error('Failed to log, ' + err);
        }
    };

    return logger;
});
