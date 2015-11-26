/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/mbta/deriveDestination.js
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var deriveDestination = function (modeName, routeName, dir, stoptime) {

        var dest = {title: '', subtitle: '' },
            testVia = /\svia\s/, //Does destination sign contain "via"?
            getBeforeVia = /\svia\s[\W\w]+$/, //Text before word "via"
            getAfterVia = /^[\W\w]+\svia\s/,  //Text after word "via"
            testParens = /\(/,   //Does destination sign contain a "("?
            getBeforeParens = /\([\W\w]+$/, //Text before (
            getAfterParens = /^[\W\w]+\(/,  //Text after (
            getAfterTo = /^[\W\w]+\sto\s/,  //Text after "... to "
            getBeforeSpace = /\s[\W\w]+$/;  //Text before " "
        if (modeName !== 'Commuter Rail') {
            if (stoptime.hasOwnProperty('trip_headsign')) {
                if (testVia.test(stoptime.trip_headsign)) {
                    //Non-commuter rail, has headsign with "via"
                    dest.title = stoptime
                        .trip_headsign
                        .replace(getBeforeVia, '');
                    dest.subtitle =
                        stoptime.trip_headsign.replace(getAfterVia, 'via ');
                    return dest;
                }
                if (testParens.test(stoptime.trip_headsign)) {
                    //Non-commuter rail, has headsign with "()"
                    dest.title =
                        stoptime.trip_headsign.replace(getBeforeParens, '');
                    dest.subtitle =
                        stoptime.trip_headsign.replace(getAfterParens, '(');
                    return dest;
                }
                //Non-commuter rail, one-line destination
                dest.title = stoptime.trip_headsign;
                return dest;
            }
            //Non-commuter rail, no headsign text at all
            dest.title = stoptime.trip_name.replace(getAfterTo, '');
            return dest;
        }
        if (stoptime.hasOwnProperty('trip_headsign')) {
            //commuter rail, with headsign
            dest.title = stoptime.trip_headsign;
            dest.subtitle = 'Train '
                + stoptime.trip_name.replace(getBeforeSpace, '');
            return dest;
        }
        dest.title = dir;
        dest.subtitle = routeName;
        return dest;

    };

    return deriveDestination;
});