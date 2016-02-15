/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Stop
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent'
], function ($, _, Backbone, AgencyComponent) {
    var Stop = AgencyComponent.extend({

        defaults: {
            modelType: 'Stop',
            color: '',
            childName: undefined,
            parentName: undefined,
            isLocal: false,
        },
        initialize: function () {
            if (this.get('name') === undefined || this.get('name') === '') {
                this.set({
                    name: this.get('parentName') || this.get('childName')
                });
            }
        },
        regexes: function () {
            var r = [];
            if (this.get('parentName')) {
                _(r).push(
                    new RegExp('\\b('
                        + this.escape('parentName')
                        + ')\\b', 'gi')
                );
            }
            if (this.get('childName')) {
                _(r).push(
                    new RegExp('\\b(' + this.escape('childName') + ')\\b', 'gi')
                );
            }
            if (this.get('name')) {
                _(r).push(
                    new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi')
                );
                if (/\s-\s/.test(this.get('name'))) {
                    _(r).push(
                        new RegExp('\\b('
                            + this.escape('name').replace(/\s-\s.*/, '')
                            + ')\\b', 'gi')
                    );
                }
            }
            return r;
        }

    });
    return Stop;
});
