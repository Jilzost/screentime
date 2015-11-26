/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/formatDelay.js
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var formatDelay = function (delay) {
        var branch,
            direction,
            severe;

        if (_(delay.branches).uniq().length === 1 &&
                _(delay.branches).first() !== '') {
            branch = _(delay.branches).first();
        }

        if (_(delay.directions).uniq().length === 1 &&
                _(delay.directions).first() !== '') {
            direction = _(delay.directions).first();
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

    return formatDelay;
});
