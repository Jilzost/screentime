/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/currentServiceAlertsCD.js
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Alerts',
    'helper/process/combinedDelayAlert'
], function ($, _, Backbone, Alerts, combinedDelayAlert) {
    var currentServiceAlertsCD = function (alerts) {
        var alertsOut = new Alerts(),   //Output builder.
            delayAlerts = new Alerts();

        alertsOut.order = 'byRoute';

        alertsOut.add(alerts.filter(function (al) {
            return (al.get('isService') &&
                    al.get('isCurrent') &&
                    (al.get('isLocal')
                      || al.get('isSubway')
                      || al.get('isSystemwide')) &&
                    (al.get('disruptionType') !== 'Delay' ||
                        al.get('isSystemwide') ||
                        (al.get('isLocal') && al.get('isSubway'))));
        }));

        delayAlerts.add(alerts.filter(function (al) {
            return (al.get('isService') &&
                    al.get('isCurrent') &&
                    (al.get('isLocal') || al.get('isSubway')) &&
                    (!al.get('isLocal') || !al.get('isSubway')) &&
                    al.get('disruptionType') === 'Delay' &&
                    !al.get('isSystemwide'));
        }));

        if (delayAlerts.length > 0) {
            alertsOut.add(combinedDelayAlert(delayAlerts));
        }

        return alertsOut.toArray();
    };

    return currentServiceAlertsCD;
});