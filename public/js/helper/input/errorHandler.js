/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/input/errorHandler.js
define([
    'jquery',
    'underscore',
    'backbone',
    //'helper/input/successHandler',
    'helper/logger'
], function ($, _, Backbone, /*successHandler,*/ logger) {
    var errorHandler = function (feed) {
        var waittime = (feed.maxAge || 60000) / 10,
            maxAge = (feed.maxAge || 60000),
            lastUpdated = feed.lastUpdated || 0;
        logger.log('st.lib.input', 'Failed to read data');
        if (lastUpdated + maxAge * 2 < Date.now()) {
            feed.reset();
            waittime = Math.min(waittime, 60000);
        }
        setTimeout(function () {feed.fetch(
            {
                //success: function () {successHandler(feed); },
                error: function () {errorHandler(feed); }
            }
        ); }, waittime);
    };

    return errorHandler;
});