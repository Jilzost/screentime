/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Screenshot
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger'
], function ($, _, Backbone, logger) {
    var Screenshot = Backbone.Model.extend({

        defaults: {
            upToDate: false,
            serverId: -1,
            actualText: '',
            genericText: '',
            firstShown: Date(0),
            lastShown: Date(0),
            totalShown: 1,
            shownSinceSync: 1,
            signId: 'sign_id_not_set'
        },
        initialize: function () {
            var genericize, postProcessers;
            this.set({firstShown: Date.now(), lastShown: Date.now()});
            postProcessers = this.get('postProcessers') || [
                {
                    regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                    replacement: ''
                },
                {
                    regex: /<div id="departures" style="display: none;">[\d\D\n\r]*<div id="currentAlerts/,
                    replacement: '<div id="currentAlerts'
                },
                {
                    regex: /<div id="currentAlerts" style="display: none;">[\d\D\n\r]*<div id="upcomingAlerts/,
                    replacement: '<div id="upcomingAlerts'
                },
                {
                    regex: /<div id="upcomingAlerts" style="display: none;">[\d\D\n\r]*<div id="elevatorAlerts/,
                    replacement: '<div id="elevatorAlerts'
                },
                {
                    regex: /<div id="elevatorAlerts" style="display: none;">[\d\D\n\r]*<div id="status/,
                    replacement: '<div id="status'
                },
                {
                    regex: /<body onload="init()">/,
                    replacement: '<body>'
                }
            ];

            genericize = this.get('genericize') || [
                { regex: /^.*display: none.*$/gm, replacement: '' },
                //Replace countdown minute digits w/ 0 or 00, for consolidation.
                {
    //To keep more records, eliminate the {1,2} and uncomment next section
                    regex: /(<td class="minutes_away"[^>]{0,25}>)[0-9]{1,2}/g,
                    replacement: '$10'
                },
                {
                    regex: /<div id="clock">[\d\:]{4,5}<\/div>/,
                    replacement: '<div id="clock">12:34</div>'
                },

            ];
            if (this.get('actualText') === '') {
                this.set({
                    actualText: '<!DOCTYPE html>' + $('html')[0].outerHTML
                });
            }
            this.set({actualText:
                    _(postProcessers).reduce(function (state, tx) {
                    return state.replace(tx.regex, tx.replacement);
                }, this.get('actualText'))
                });

            this.set({genericText:
                    _(genericize).reduce(function (state, tx) {
                    return state.replace(tx.regex, tx.replacement);
                }, this.get('actualText'))
                });
        },
        updateCount: function () {
            this.set({
                upToDate: false,
                lastShown: Date.now(),
                totalShown: this.get('totalShown') + 1,
                shownSinceSync: this.get('shownSinceSync') + 1
            });
        },
        sync: function () {
            var self = this;
            if (this.get('serverId') === -1) {
                $.ajax({
                    url: 'postsample',
                    method: 'POST',
                    dataType: 'json',
                    data: JSON.stringify({
                        signId: this.get('signId'),
                        serverId: this.get('serverId'),
                        actualText: this.get('actualText'),
                        firstShown: this.get('firstShown'),
                        lastShown: this.get('lastShown'),
                        shownSinceSync: this.get('shownSinceSync')
                    }),
                    context: this,
                    success: function (resp) {
                        this.set({
                            serverId: resp,
                            shownSinceSync: 0,
                            upToDate: true
                        });
                    },
                    error: function (req, status, err) {
                        logger.log('Screenshot sync 1', status + ' ' + err);
                    }
                });
                return this;
            }
            //else: send just the latest stats
            $.ajax({
                url: 'postsamplestat',
                method: 'POST',
                dataType: 'json',
                data: JSON.stringify({
                    signId: this.get('signId'),
                    serverId: this.get('serverId'),
                    shownSinceSync: this.get('shownSinceSync'),
                    lastShown: this.get('lastShown')
                }),
                success: function (resp) {
                    if (!isNaN(resp)) {
                        self.set({serverId: resp});
                    }
                },
                error: function (req, status, err) {
                    logger.log('Screenshot sync 2', status + ' ' + err);
                }
            });
            this.set({
                shownSinceSync: 0,
                upToDate: true
            });

        }
    });

    return Screenshot;
});
