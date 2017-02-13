/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 node: true */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/PsaAgency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',//future: add logging
    'models/Alert',
    'models/Route',
    'collections/Alerts',
    'collections/Routes',
    'collections/Departures',
    'collections/Psas',
    'collections/RealtimeSource',
    'helper/input/inputLoop',
], function ($, _, Backbone, logger, Alert, Route,
    Alerts, Routes, Departures, Psas, RealtimeSource, inputLoop) {

    var PsaAgency = Backbone.Model.extend({
        defaults: {
            name: undefined,
            sourceType: 'PSA-only',
            stops: [],
            routes: undefined,
            departures: undefined,
            alerts: undefined,
            psas: undefined,
            featuredAlerts: undefined
        },
        initialize: function () {
            var agency = this,
                psaSource,
                feed;

            agency.buildPsas = _.bind(agency.buildPsas, agency);
            /**/
            psaSource = new Psas();
            psaSource.url = agency.get('psas');
            psaSource.agency = agency;
            psaSource.maxAge = 7260001; //is this the right way to set this?
            agency.set('psaSource', psaSource);

            agency.set({psas: new Psas()});
            agency.set({alerts: new Alerts()});
            agency.set({featuredAlerts: new Alerts()});
            agency.set({departures: new Departures()});
            agency.set({routes: new Routes()});

            agency.get('psas').listenTo(agency.get('psaSource'),
                        'reset sync',
                        function () {agency.buildPsas(agency); });



            feed = agency.get('psaSource');
            inputLoop({feed: feed, waittime: 0});

            /***/
        },
        buildPsas: function (thisAgency) {
          var newPsas = [];
          thisAgency.get('psaSource').each(function (psa) {
            newPsas.push(psa.toJSON());
          });
          thisAgency.get('psas').reset(newPsas);
//          thisAgency.get('psas').reset(thisAgency.get('psaSource').toArray());

          return this;
        }
    });

    return PsaAgency;
});
