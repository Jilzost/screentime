/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Departure
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var Departure = Backbone.Model.extend({
        defaults: {
            modelType: 'Departure',
            route: undefined,
            direction: undefined,
            tripId: undefined,
            serviceGroup: undefined,
            locationName: '',
            destinationTitle: '',
            destinationSubtitle: '',
            scheduledTime: 0,
            predictedTime: 0,
            time: 0,
            isPrediction: false
        },
        initialize: function () {
            if (this.get('predictedTime') > 0) {
                this.set({time: this.get('predictedTime'),
                    isPrediction: true});
            } else if (this.get('scheduledTime') > 0) {
                this.set({time: this.get('scheduledTime'),
                    isPrediction: false});
            }
            if (this.get('serviceGroup') === undefined) {
                switch (this.get('route').get('mode')) {
                case 'Subway':
                    this.set({
                        serviceGroup: this.get('route').get('trunkName') + '-' +
                                this.get('destinationTitle')
                    });
                    break;
                case 'Bus':
                    this.set({
                        serviceGroup: this.get('route').get('name') + '-' +
                                this.get('direction')
                    });
                    break;
                case 'Commuter Rail':
                    this.set({serviceGroup: this.get('destinationTitle')});
                    break;
                case 'Boat':
                    this.set({serviceGroup: this.get('destinationTitle')});
                    break;
                default:
                    this.set({serviceGroup: this.get('destinationTitle')});
                    break;
                }
            }
        },
        /**
         * Departure is "soon" if it's no more than one minute in the past
         * and no more than 65 minutes in the future.
         * @return {Boolean} is departure soon.
         */
        isSoon: function () {
            return (Date.now() - 60000 < this.get('time') &&
                    this.get('time') < Date.now() + 60000 * 65);
        },
        /**
         * Returns an integer number of minutes to display. 
         * @return {[type]} minutes away (integer)
         */
        minsAway: function () {
            return Math.max(
                Math.floor((this.get('time') - Date.now()) / 60000),
                0
            );
        },
        //TODO the following should be moved to a view. 
        /**
         * Returns string suitable for speech synthesis. 
         * @return {string} String for speech synthesis. 
         */
        vocalize: function () {
            var text = '', minutes = this.minsAway();
            if (this.route.mode === 'Bus') {
                text += 'Route ';
            }
            text += this.route.name.replace('/', ' ')
                + ' '
                + this.destinationTitle
                + ', ';
            text += minutes + (minutes === 1 ? ' minute' : ' minutes');
            return text;
        }
    });
    return Departure;
});
