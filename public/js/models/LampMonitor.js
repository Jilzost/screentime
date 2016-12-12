/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/LampMonitor
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger'
], function ($, _, Backbone, logger) {
    var LampMonitor = Backbone.Model.extend({
        defaults: {
            url: 'http://localhost/cgi-bin/lamps.cgi',
            //url: 'http://localhost/cgi-bin/lamps.cgi?value=1',
            expected: '',
            last: '',
            checkRate: 90 * 1000
        },
        initialize: function () {
            var self = this;
            self.set({last: self.get('expected')});
            setInterval(function () {
                self.checkLamp();
            }, self.get('checkRate'));
            return this;
        },
        checkLamp: function () {
            var self = this;
            $.get(self.get('url'))
                .done(function (data) {
                    self.checkLampResults(data);
                })
                .fail(function () {
                    logger.log('lampControl', 'Lamp check failed');
                });
        },
        checkLampResults: function (data) {
            var self = this;
            if (_(data).isEqual(self.get('last'))) {
                return this;
            }
            if (_(data).isEqual(self.get('expected'))) {
                logger.log('lampControl',
                    'Screen OK: Lamp check now returning ' +
                    JSON.stringify(data));
            } else {
                logger.log('lampControl',
                    'Screen problem: Lamp check returned ' +
                    JSON.stringify(data));
            }
            self.set({last: data});
        }
    });
    return LampMonitor;
});
