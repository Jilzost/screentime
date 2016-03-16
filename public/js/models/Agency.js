/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Agency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger'
], function ($, _, Backbone, logger) {
    var Agency = Backbone.Model.extend({

        defaults: {
            name: undefined,
            sourceType: undefined,
            routes: undefined,
            departures: undefined,
            alerts: undefined,
            featuredAlerts: undefined
        }
    });

    return Agency;
});
