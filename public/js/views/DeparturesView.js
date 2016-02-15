/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/DeparturesView
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Departures',
    'views/DepartureView',
//    'helper/process/nextDepartures',
    'text!templates/departures.html'
], function ($, _, Backbone, Departures, DepartureView, departuresTemplate) {
    var nextDepartures = function (deps) {
        var nextDeps = new Departures();

        deps = new Departures(deps.toArray());

        nextDeps.order = 'presentationOrder';
        deps.order = 'predictionTimeOrder';
        deps.sort();

        deps.each(function (dep) {

            if (!nextDeps.findWhere({
                    serviceGroup: dep.get('serviceGroup')
                })) {
                nextDeps.add(dep);
            }
        });

        return (nextDeps.toArray());
    };

    var DeparturesView = Backbone.View.extend({

        el: '#departures',
        template: _.template(departuresTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
            this.lastHeight = 0;
            this.fontSize = 100;
            this.hasContent = false;
            this.speechScript = [];
            this.render();
        },
        render: function () {
            var html, deps;
            this.speechScript = [];
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.lastHeight = 0;
                this.hasContent = false;
                return this;
            }
            this.hasContent = true;
            html = this.template(this.model.toJSON());
            this.fontSize = 100;
            this.$('tbody').css('fontSize', this.fontSize + '%');
            this.$el.html(html);
            this.speechScript.push(this.model.get('titleText'));

            deps = nextDepartures(this.model.get('collection'));
            deps = _(deps).filter(function (x) {
                return (Date.now() - 90000 < x.get('time') &&
                        x.get('time') < Date.now() + 60000 * 65);
            });
            deps = new Departures(deps);
            deps.order = 'presentationOrder';
            deps.sort();

            deps.each(function (x) {
                var item = new DepartureView(
                    {model: x, className: x.get('route').get('mode')}
                );
                this.$('tbody').append(item.render().$el);
                this.speechScript.push(
                    x.get('route').get('longName').replace('/', ' ') + ' ' +
                        x.get('destinationTitle') + ', ' +
                        x.minsAway() +
                        (x.minsAway() === 1 ? ' minute' : ' minutes')
                );
            }, this);
            this.lastHeight = Math.max(this.$el.height(), 1);
            while (this.fontSize > 1 && this.lastHeight > window.innerHeight) {
                this.fontSize -= 1;
                this.$('tbody').css('fontSize', this.fontSize + '%');
                this.lastHeight = Math.max(this.$el.height(), 1);
            }
            return this;
        }
    });

    return DeparturesView;
});
