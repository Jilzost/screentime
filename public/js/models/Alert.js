/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Alert
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent',
    'collections/AgencyComponents'
], function ($, _, Backbone, AgencyComponent, AgencyComponents) {
    var Alert = AgencyComponent.extend({

        defaults: {
            modelType: 'Alert',
            txid: '',
            affecteds: undefined,
            timeframe: '',
            startTime: Date(0),
            endTime: Date(0),
            disruptionType: '',
            summary: '',
            description: '',
            details: '',
            isService: false,
            isElevator: false,
            isRelevant: false,
            isNow: false,
            isSoon: false,
            severityPct: 0, //1-24: negligible, 25-49: minor,
                            //50-74: significant, 75-99: severe,
                            //100: maximum severity
            isFeatured: false
        },
        initialize: function () {
            this.set({affecteds: new AgencyComponents()});
        },
        getFormatted: function (propName) {
            //have an array: Route, Stop, AccessFeature.
            //Use that to try routes; if there are no changes try stops; etc. 
            //Should each Route, Stop etc be able to produce its own list of
            //regular expressions? Should they have their own "highlight" fxn?
            var input = this.escape(propName),
                tests = ['Route', 'Stop', 'AccessFeature'],
                allRegexes,
                appliedRegexes = [],
                i,
                j,
                k,
                routeSuccess = false,
                success = false,
                affecteds = this.get('affecteds');

            input = input.replace(/http:\/\//gi, '');
            input = input.replace(/\r/g, '<br>');

            allRegexes = _(tests).reduce(function (memo, test) {
                memo.push(affecteds.reduce(function (memo2, affected) {
                    if (affected.get('modelType') === test) {
                        _(memo2).push({
                            regexes: affected.regexes(),
                            modelType: affected.get('modelType'),
                            color: affected.get('color')
                        });
                    }
                    return memo2;
                }, []));
                return memo;
            }, []);

            // console.log(allRegexes);

            for (i = 0; i < allRegexes.length; i += 1) {
                if (!success) {
                    for (j = 0; j < allRegexes[i].length; j += 1) {
                        routeSuccess = false;
                        for (k = 0;
                                k < allRegexes[i][j].regexes.length;
                                k += 1) {
                            if (!routeSuccess &&
                                    allRegexes[i][j].regexes[k].test(input) &&
                                    !_(appliedRegexes).contains(
                                        String(allRegexes[i][j].regexes[k])
                                    ) &&
                                    allRegexes[i][j].regexes[k].color !== '') {
                                success = true;
                                routeSuccess = true;
                                appliedRegexes.push(
                                    String(allRegexes[i][j].regexes[k])
                                );
                                input = input.replace(
                                    allRegexes[i][j].regexes[k],
                                    '<span style="color:'
                                        + allRegexes[i][j].color
                                        + '">'
                                        + '$1' + '</span>'
                                );
                            }
                        }
                    }
                }
            }
            return input;
        }
    });

    return Alert;
});
