/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/combinedDelayAlert.js
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Alert',
    'collections/Routes',
    'helper/process/formatDelay'
], function ($, _, Backbone, Alert, Routes, formatDelay) {
    var combinedDelayAlert = function (alerts) {


        /**************************************************
         For each alert, for each not-hidden route: 
           Generate the serviceName. 
           Is there a delayBundle with this serviceName? 
             If not, create one. 
                 serviceName (chop off everything after "line")
                 branch list (show 2 at most)
                 direction list (show 1 at most)
                 isRoute (if bus and doesn't contain "line")
                 severity
                 sort order
             If there is, modify it if necessary. 
                 add to branch list?
                 add to direction list?
                 change severity to true?
             
             Then create a list of each serviceName. 
        ***************************************************/
        var delays = [],
            routeDelays = [],
            lineDelays = [],
            delay,
            serviceName,
            isSevere,
            affectedDirection,
            remainingDelayed, //Remaining (not-yet-listed) delays
            description, //For alert being created
            routes = new Routes(),
            newAlert;

        newAlert = new Alert({
            txid: 'CombinedDelayAlert',
            disruptionType: 'Delays',
            isCurrent: true,
            isService: true
        });

        alerts.each(function (a) {
            affectedDirection = a.get('affectedDirection');
            isSevere = a.get('isSevere');
            routes.add(a.get('affecteds').where({
                modelType: 'Route',
                isHidden: false
            }));
            routes.each(function (r) {
                newAlert.get('affecteds').add(r);
                serviceName = r.get('trunkName');
                if (!_(delays).findWhere({serviceName: serviceName})) {
                    //New serviceName, new delay
                    delay = {
                        serviceName: serviceName,
                        branches: [],
                        directions: [affectedDirection],
                        isRoute: (r.get('mode') === 'Bus' &&
                            r.get('name').search(/Line/) === -1),
                        isSevere: isSevere,
                        sortOrder: r.get('sortOrder')
                    };
                    if (r.get('branchName') !== '') {
                        delay.branches.push(r.get('branchName'));
                    }
                    delays.push(delay);
                } else {
                    //Existing serviceName
                    delay = _(delays).findWhere({serviceName: serviceName});
                    if (r.get('branchName') !== '') {
                        delay.branches.push(r.get('branchName'));
                        delay.directions.push(affectedDirection);
                        delay.isSevere = delay.isSevere || isSevere;
                    }
                }
            });
        });

        routeDelays = _(delays).where({isRoute: true});
        lineDelays = _(delays).where({isRoute: false});
        routeDelays.sort(function (a, b) {return a.sortOrder - b.sortOrder; });
        lineDelays.sort(function (a, b) {return a.sortOrder - b.sortOrder; });

        description = 'Delays on ';
        if (lineDelays.length > 0) {
            description += 'the ';
            remainingDelayed = lineDelays.length
                + ((routeDelays.length > 0) ? 1 : 0);
            _(lineDelays).each(function (d) {
                remainingDelayed -= 1;
                switch (remainingDelayed) {
                case 0:
                    description += formatDelay(d);
                    break;
                case 1:
                    if (lineDelays.length === 1) {
                        description += formatDelay(d) + ' and ';
                    } else {
                        description += formatDelay(d) + ', and ';
                    }
                    break;
                default:
                    description += formatDelay(d) + ', ';
                    break;
                }
            });
        }

            //Create list of bus delays
        if (routeDelays.length > 0) {
            description += (routeDelays.length === 1) ? 'route ' : 'routes ';
            remainingDelayed = routeDelays.length;
            _(routeDelays).each(function (d) {
                remainingDelayed -= 1;
                switch (remainingDelayed) {
                case 0:
                    description +=  formatDelay(d);
                    break;
                case 1:
                    description += formatDelay(d) + ' and ';
                    break;
                default:
                    description += formatDelay(d) + ', ';
                    break;
                }
            });
        }

        description += '.';
        newAlert.set({description: description});

        return newAlert;
    };

    return combinedDelayAlert;
});