/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/format/mixCase.js
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var mixCase = function (str) {
        return str.charAt(0).toUpperCase() +
                str.substring(1).toLowerCase();
    };

    return mixCase;
});

//FOR FUTURE USE