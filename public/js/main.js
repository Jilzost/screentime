/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis,
document, window, _, $, Backbone, agencyConfig, io, signConfig, meSpeak */
'use strict';

require.config({
    paths: {
        "jquery": "libs/jquery",
        "underscore": "libs/underscore",
        "backbone": "libs/backbone",
        "mespeak": "libs/mespeak/mespeak.full",
        "io": "//cdn.socket.io/socket.io-1.3.7"
    }
});

require(['helper/process/bootup'], function (bootup) {
    bootup();
});