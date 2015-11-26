/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/DeparturesView
define([
    'jquery',
    'underscore',
    'backbone',
    'views/DepartureView',
    'text!templates/departures.html'
], function ($, _, Backbone, DepartureView, departuresTemplate) {
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
            var html;
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
            this.model.get('collection').each(function (x) {
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
