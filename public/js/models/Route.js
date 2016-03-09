/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Route
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent'
], function ($, _, Backbone, AgencyComponent) {
    var Route = AgencyComponent.extend({

        defaults: {
            modelType: 'Route',
            mode: 'Bus',
            name: '',      //1         Red line   Green Line C       
            longName: '',  //Route 1   Red Line   Green Line C branch
            trunkName: '', //1         Red Line   Green Line         
            branchName: '',//''        ''         C                  
            shortName: '', //1         Red        C                  
            color: '',
            isMode: false,
            isLocal: false,
            isHidden: false,
            sortOrder: 0,
        },
        initialize: function () {
            if (this.get('longName') === '') {
                if (this.get('mode') === 'Bus' &&
                        this.get('name').search(/Line/i) === -1) {
                    this.set({longName: 'Route ' + this.get('name')});
                } else if (this.get('name').search(/Line\s\w/) !== -1) {
                    this.set({longName: this.get('name') + ' branch'});
                } else {
                    this.set({longName: this.get('name')});
                }
            }
            if (this.get('branchName') === '') {
                if (this.get('name').search(/Line\s\w/) !== -1) {
                    this.set({
                        branchName: this.get('name').replace(/.*Line\s/, '')
                    });
                }
            }
            if (this.get('trunkName') === '') {
                this.set({trunkName: this.get('name')
                    .replace(/Line.*/, 'Line')});
            }
            if (this.get('shortName') === '') {
                if (this.get('branchName') !== '') {
                    //FUTURE IMPROVEMENT: take only the beginning? 
                    //This includes a "Short name" of "waterfront"
                    this.set({shortName: this.get('branchName')});
                } else if (this.get('mode') === 'Commuter Rail') {
                    this.set({shortName: 'Rail'});
                } else if (this.get('mode') === 'Boat') {
                    this.set({shortName: 'Boat'});
                } else {
                    this.set({shortName: this.get('name').split(' ')[0]});
                }
            }
        },
        regexes: function () {
            var r = [],
                names = ['longName', 'name', 'trunkName', 'branchName',
                    'shortName'],
                slashLine = /([\W\w]*)\s?\/\s?([\W\w]*)(\sLine)$/,
                result;

            _(names).each(function (i) {
                if (this.get(i) !== undefined && this.escape(i) !== '') {
                    _(r).push(
                        new RegExp('\\b(' + this.escape(i) + ')\\b', 'gi')
                    );
                }
            }, this);

            if (slashLine.test(this.escape('longName'))) {
                result = slashLine.exec(this.escape('longName'));
                _(r).push(
                    new RegExp('\\b(' + result[1] + result[3] + ')\\b', 'gi')
                );
                _(r).push(
                    new RegExp('\\b(' + result[2] + result[3] + ')\\b', 'gi')
                );
            }

            return _(r).uniq();
        }
    });

    return Route;
});
