/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Train
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent'
], function ($, _, Backbone, AgencyComponent) {
    var Train = AgencyComponent.extend({

        defaults: {
            modelType: 'Train',
            name: '',
            shortName: '',
            longName: '',
            sortOrder: 0
        },
        // initialize: function () {
        //     if (this.get('name') === undefined || this.get('name') === '') {
        //         this.set({
        //             name: this.get('parentName') || this.get('childName')
        //         });
        //     }
        // },
        regexes: function () {
            return new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi');
        }

    });
    return Train;
});
