// Filename: models/ScreenData

/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Alerts',
    'collections/Departures'
], function ($, _, Backbone, Alerts, Departures) {
    var ScreenData = Backbone.Model.extend({

        defaults: {
            alertsSources: [],
            featuredAlertsSources: [],
            departuresSources: [],
            alerts: undefined,
            departures: undefined,
            featuredAlerts: undefined
        },
        initialize: function () {
            this.set('departures', new Departures());
            this.set('alerts', new Alerts());
            this.set('featuredAlerts', new Alerts());
        },
        refresh: function (coll) {
            var newColl = [];
            _(this.get(coll + 'Sources')).each(function (c) {
                newColl = newColl.concat(c.toArray());
            });
            this.get(coll).reset(newColl);
        }
    });
    return ScreenData;
});
