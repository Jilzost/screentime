/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Heartbeat
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var Heartbeat = Backbone.Model.extend({
        defaults: {
            url: '/heartbeathandler',
            sign: '',
            timestamp: Date(0),
            uptime: Date(0),
            heartbeatRate: 60000
        },
        initialize: function () {
            this.set({timestamp: Date.now()});
        }
    });
    return Heartbeat;
});
