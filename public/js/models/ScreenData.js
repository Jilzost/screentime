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
            featuredAlertsSources: [],
            departuresSources: [],
            currentServiceAlertsCDSources: [],
            upcomingServiceAlertsSources: [],
            elevatorAlertsSources: [],
            featuredAlerts: undefined,
            departures: undefined,
            currentAlerts: undefined,
            upcomingServiceAlerts: undefined,
            elevatorAlerts: undefined
        },
        initialize: function () {
            this.set('featuredAlerts', new Alerts());
            this.set('departures', new Departures());
            this.set('currentServiceAlertsCD', new Alerts());
            this.set('upcomingServiceAlerts', new Alerts());
            this.set('elevatorAlerts', new Alerts());
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
