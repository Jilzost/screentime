/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 node: true */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/NextbusAgency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',//future: add logging
    'models/Alert',
    'models/AccessFeature',
    'models/Stop',
    'models/Route',
    'models/Train',
    'collections/Alerts',
    'collections/Routes',
    'collections/Trains',
    'collections/Departures',
    'collections/Psas',
    'collections/RealtimeSource',
    'helper/input/inputLoop',
    'helper/mbta/pickRouteColor',//Future work: tie to agency generically
    'helper/process/combinedDelayAlert'
], function ($, _, Backbone, logger, Alert, AccessFeature, Stop, Route,
    Train, Alerts, Routes, Trains, Departures, Psas, RealtimeSource, inputLoop,
    pickRouteColor, combinedDelayAlert) {

    var NextbusAgency = Backbone.Model.extend({
        defaults: {
            name: undefined,
            sourceType: 'Nextbus',
            routes: undefined,
            departures: undefined,
            alerts: undefined,
            featuredAlerts: undefined,
            routesMaxAge: 86400000,
            departuresMaxAge: 30000,
            alertsMaxAge: 60000,
            outputLocalAlerts: false,
            outputAllAlerts: false,
            outputDepartures: true,
            sourceParams: undefined
        },
        initialize: function () {
            var agency = this,
                allSources = [],
                routesSources = [],
                localRoutesSources = [],
                alertSources = [],
                departureSources = [],
                destOverride,
                departuresSource,
                params = $.param(agency.get('sourceParams'));

                //TODO: get, store sourceParams

                //TODO: mimic "initializeSource", create for route, departure, alert

            agency.set('routes', new Routes());
            agency.get('routes').url = '/nextbus/routes?' + params;
            agency.get('routes').maxAge = agency.get('routesMaxAge');
            agency.get('routes').agency = agency;

            inputLoop({feed: agency.get('routes'), waittime: 0});

            agency.set('departures', new Departures());
            agency.get('departures').url = '/nextbus/departures?' + params;
            agency.get('departures').maxAge = agency.get('departuresMaxAge');
            agency.get('departures').agency = agency;
            //agency.get('departures').order = 'routeOrder';

            inputLoop({feed: agency.get('departures'), waittime: 5000});
        }
    });

    return NextbusAgency;
});
