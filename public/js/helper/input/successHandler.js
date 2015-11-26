/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/input/successHandler.js
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/input/errorHandler'
], function ($, _, Backbone, errorHandler) {
    var successHandler = function (feed) {
        console.log (errorHandler);
        setTimeout(function () {feed.fetch(
            {
                success: function () {successHandler(feed); },
                error: function () {errorHandler(feed); }
            }
        ); }, feed.maxAge || 60000);
        feed.lastUpdated = Date.now();
    };

    return successHandler;
});
