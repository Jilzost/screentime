/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/AlertsView
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Alerts',
    'text!templates/alerts.html'
], function ($, _, Backbone, Alerts, alertsTemplate) {
    var AlertsView = Backbone.View.extend({

        template: _.template(alertsTemplate),
        initialize: function (options) {
            this.options = options;
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
            this.hasContent = false;
            this.lastHeight = 0;
            this.fontSize = 100;
            this.speechScript = [];
            this.render();
        },
        render: function () {
            var html, alerts;
            this.speechScript = [];
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
                return this;
            }
            if (this.model.get('where')) {
                alerts = new Alerts(this.model.get('collection').where(this.model.get('where')));
            } else {
                alerts = this.model.get('collection');
            }
            if (alerts.length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
                return this;
            }
            this.hasContent = true;
            html = this.template();
            this.$el.html(html);
            this.fontSize = 100;
            this.$('.alerts-list').css('fontSize', this.fontSize + '%');
            this.speechScript.push(this.model.get('titleText'));
            alerts.each(function (x) {
                var item = new this.options.AlertView(
                    {model: x}
                );
                this.$('.alerts-list').append(item.render().$el);
                this.speechScript.push(x.get('description'));
            }, this);
            this.lastHeight = this.$el.height();            while (this.fontSize > 1 && this.lastHeight > window.innerHeight) {
                this.fontSize -= 1;
                this.$('.alerts-list').css('fontSize', this.fontSize + '%');
                this.lastHeight = Math.max(this.$el.height(), 1);
            }
            return this;
        },
    });


    return AlertsView;
});
