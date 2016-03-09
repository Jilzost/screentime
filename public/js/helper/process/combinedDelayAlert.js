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
    'collections/Trains'
], function ($, _, Backbone, Alert, Routes, Trains) {
    var formatDelay = function (delay) {
        var trains,
            branch,
            direction,
            severe;

        if (_(delay.directions).uniq().length === 1 &&
                typeof _(delay.directions).first() === 'string' &&
                _(delay.directions).first() !== '') {
            direction = _(delay.directions).first().toLowerCase();
        }

        trains = delay.trains.pluck('shortName');

        if (_(trains).uniq().length === 1) {
            branch = 'train ' + trains[0];
            direction = false;
        } else if (_(trains).uniq().length === 2) {
            branch = 'trains ' + trains[0]
                + ' and ' + trains[1];
            direction = false;
        } else if (_(delay.branches).uniq().length === 1 &&
                _(delay.branches).first() !== '') {
            branch = _(delay.branches).first();
        } else if (_(delay.branches).uniq().length === 2 &&
                _(delay.branches).first() !== '') {
            branch = _(delay.branches).first() +
                ' and ' + _(delay.branches).last();
        }

        if (delay.isSevere) {
            severe = 'severe';
        }

        return delay.serviceName +
                    (branch || direction || severe ? ' (' : '') +
                    (branch || '') +
                    (branch && direction ? ' ' : '') +
                    (direction || '') +
                    ((branch || direction) && severe ? ', ' : '') +
                    (severe || '') +
                    (branch || direction || severe ? ')' : '');
    };

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
            direction,
            remainingDelayed, //Remaining (not-yet-listed) delays
            description, //For alert being created
            routes = new Routes(),
            trains = new Trains(),
            newAlert;

        newAlert = new Alert({
            txid: 'CombinedDelayAlert',
            disruptionType: 'Delays',
            isNow: true,
            isService: true,
            isRelevant: true
        });

        alerts.each(function (a) {
            isSevere = a.get('severityPct') >= 75;
            routes.add(a.get('affecteds').where({
                modelType: 'Route',
                isHidden: false
            }));
            trains.add(a.get('affecteds').where({
                modelType: 'Train'
            }));
            routes.each(function (r) {
                direction = r.get('direction');
                newAlert.get('affecteds').add(r);
                serviceName = r.get('trunkName');
                if (!_(delays).findWhere({serviceName: serviceName})) {
                    //New serviceName, new delay
                    delay = {
                        serviceName: serviceName,
                        branches: [],
                        directions: [],
                        trains: new Trains(),
                        isRoute: (r.get('mode') === 'Bus' &&
                            r.get('name').search(/Line/) === -1),
                        isSevere: isSevere,
                        sortOrder: r.get('sortOrder')
                    };
                    if (r.get('branchName') !== '') {
                        delay.branches.push(r.get('branchName'));
                    }
                    if (direction) { delay.directions.push(direction); }

                    delays.push(delay);
                } else {
                    //Existing serviceName
                    delay = _(delays).findWhere({serviceName: serviceName});
                    if (r.get('branchName') !== '') {
                        delay.branches.push(r.get('branchName'));
                        if (direction) {
                            delay.directions.push(direction);
                            delay.directions = _.uniq(delay.directions);
                        }
                        delay.isSevere = delay.isSevere || isSevere;
                    }
                }
            });
            trains.each(function (t) {
                delay = _(delays).findWhere({
                    serviceName: t.get('route').get('trunkName')
                });
                if (delay) {
                    if (!delay.trains.findWhere({txid: t.get('txid')})) {
                        delay.trains.push(t);
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
                    if (lineDelays.length <= 2) {
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
                    if (routeDelays.length <= 2) {
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

        description += '.';
        newAlert.set({description: description});

        return newAlert;
    };

    return combinedDelayAlert;
});