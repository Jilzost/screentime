/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 node: true */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/AggAgency
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

    var AggAgency = Backbone.Model.extend({
        defaults: {
            name: undefined,
            sourceType: 'PSA-only',
            routes: undefined,
            routesSources: [],
            departures: undefined,
            departuresSources: [],
            alerts: undefined,
            alertsSources: [],
            psas: undefined,
            psasSources: [],
            featuredAlerts: undefined,
            featuredAlertsSources: []
        },
        initialize: function () {
            var agency = this,
                psaSource,
                feed;

            agency.buildAggregate = _.bind(agency.buildAggregate, agency);
            agency.addAgency = _.bind(agency.addAgency, agency);
            /**/
            agency.set({psas: new Psas()});
            agency.set({alerts: new Alerts()});
            agency.set({featuredAlerts: new Alerts()});
            agency.set({departures: new Departures()});
            agency.set({routes: new Routes()});

            // agency.get('psas').listenTo(agency.get('psaSource'),
            //             'reset sync',
            //             function () {agency.buildPsas(agency); });

        },
        addAgency: function (newAgency) {
          //Is scope correct?
          var thisAgency = this;
          _(['alerts',
              'psas',
              'featuredAlerts',
              'departures']).each(function (x) {
              if (newAgency.get(x)) {
                  thisAgency.get(x + 'Sources').push(
                      newAgency.get(x)
                  );
                  thisAgency.get(x).listenTo(
                      newAgency.get(x),
                      'reset sync change',
                      function () {
                          return thisAgency.buildAggregate(thisAgency, x);
                      }
                  );
              }
          }, thisAgency); //was "this" before copied here
          return this;
        },
        buildAggregate: function (thisAgency, aggTarget) {
          var newCollection = [];
          if (!thisAgency.get(aggTarget)) {
            console.log('AggAgency error: unsupported collection');
            return this;
          }
          if (aggTarget === 'psas' && featuredAlerts.length > 0) {
            thisAgency.get('psas').reset();
            return this;
          }

          _(thisAgency.get(aggTarget + 'Sources')).each(function (source) {
            newCollection = newCollection.concat(source.toArray());
          });

          thisAgency.get(aggTarget).reset(newCollection);

          return this;
        }
    });

    return AggAgency;
});
