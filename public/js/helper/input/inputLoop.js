/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/input/inputLoop.js
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger'
], function ($, _, Backbone, logger) {
    var inputLoop = function (input) {
        var waittime, maxAge, lastUpdated;
        if (input.failed) {
            waittime = (input.feed.maxAge || 60000) / 10;
            maxAge = (input.feed.maxAge || 60000);
            lastUpdated = input.feed.lastUpdated || 0;
            logger.log('helper/input/inputLoop', 'Failed to read data');
            if (lastUpdated + maxAge * 2 < Date.now()) {
                input.feed.reset();
                waittime = Math.min(waittime, 60000);
            }
        } else {
            waittime = input.feed.maxAge || 60000;
        }
        setTimeout(function () {input.feed.fetch(
            {
                success: function () {inputLoop({feed: input.feed}); },
                error: function () {inputLoop({feed: input.feed, failed: true}); }
            }
        ); }, waittime);
    };

    return inputLoop;
});
