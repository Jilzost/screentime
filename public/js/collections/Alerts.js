/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Alerts
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Alert'
], function ($, _, Backbone, Alert) {
    var Alerts = Backbone.Collection.extend({

        model: Alert,
        maxAge: 60000,
        order: 'txid',
        comparator: function (model) {
            switch (this.order) {
            case 'byRoute':
                return model.get('affecteds').first().get('sortOrder');
            case 'byTime':
                return model.get('startTime') * 10000000000000 +
                        model.get('endTime');
            case 'byTimeAndRoute':
                return model.get('startTime') * 10000000000000 +
                        model.get('affecteds').first().get('sortOrder');
            case 'byElevatorStation':
                return model.get('affectedStation') || model.get('summary');
            case 'byElevatorTimeAndStation':
                return (model.get('isSoon') ? model.get('startTime') : '0000') +
                    model.get('stationName') || model.get('summary');
            default:
                return model.get(this.order);
            }
        }
    });

    return Alerts;
});
