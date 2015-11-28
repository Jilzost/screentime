/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/bootup.js
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Sign'
], function ($, _, Backbone, Sign) {
    var bootup = function () {
        var s = new Sign();
    };

    return bootup;
});
