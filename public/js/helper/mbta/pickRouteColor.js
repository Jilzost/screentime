/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/mbta/pickRouteColor
// 
// Future work: this should be associated directly with an agency, using
// a generic pattern-matching system. 
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var pickRouteColor = function (modeName, routeName) {
        switch (routeName) {
        case 'Green Line B':
        case 'Green Line C':
        case 'Green Line D':
        case 'Green Line E':
            return '#33FF33';
        case 'Red Line':
        case 'Mattapan Trolley':
            return '#FF6464';
        case 'Blue Line':
            return '#80AAFF';
        case 'Orange Line':
            return '#E87200';
        case 'SL1':
        case 'SL2':
        case 'SL3':
        case 'SL4':
        case 'SL5':
        case 'SL6':
        case 'Silver Line SL1':
        case 'Silver Line SL2':
        case 'Silver Line SL3':
        case 'Silver Line SL4':
        case 'Silver Line SL5':
        case 'Silver Line SL6':
        case 'Silver Line Waterfront':
        case 'Silver Line':
            return '#D0D0FF';
        default:
            switch (modeName) {
            case 'Bus':
                return '#FFFF7C';
            case 'Commuter Rail':
                return '#F81EFF';
            case 'Boat':
                return '#66CCFF';
            default:
                return '#FFFFFF';
            }
        }
    };

    return pickRouteColor;
});
