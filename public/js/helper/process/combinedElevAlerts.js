/*jslint devel: true nomen: true regexp: true indent: 2 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/combinedElevAlerts.js
define([
  'jquery',
  'underscore',
  'backbone',
  'models/Alert',
  'collections/Alerts'
], function ($, _, Backbone, Alert, Alerts) {

  var combinedElevAlerts = function (alerts) {
      var consolidated = new Alerts();
      consolidated = alerts.reduce(function (memo, newAlert) {
        var existingAlert, newElevator;
        newElevator = newAlert.get('affecteds').findWhere({modelType: 'AccessFeature'});
        newElevator.set(
          {
            isNow: newAlert.get('isNow'),
            isSoon: newAlert.get('isSoon'),
            timeframe: newAlert.get('timeframe')
          }

        );
        existingAlert = memo.findWhere(
          {
            affectedStation: newAlert.get('affectedStation')
          }
        );
        if (existingAlert) {
          newElevator = newAlert.get('affecteds').findWhere({modelType: 'AccessFeature'});
          existingAlert.get('affecteds').add(newElevator);
          if (newAlert.get('isRelevant')) {
            existingAlert.set({isRelevant: true});
          }
          if (newAlert.get('isSoon')) {
            existingAlert.set({isSoon: true});
          }
          if (newAlert.get('isNow')) {
            existingAlert.set({isNow: true, isSoon: false});
          }
        } else {
          newAlert.get('affecteds').comparator = 'elevId';
          memo.push(newAlert);
        }
        return memo;
      }, consolidated);
      return (consolidated.toArray());

    };

  return combinedElevAlerts;
});
