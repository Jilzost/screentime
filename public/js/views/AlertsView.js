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
            this.subSlides = 1;
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
            this.minFontSize = 80; //TODO make this configurable
            this.speechScript = [];
            this.renderDuration = false;
            this.renderRefreshAll = false;
            this.renderOnly = false;
            this.render();
        },
        render: function () {
            var self = this,
                html,
                alerts,
                height,
                renderRefreshAll = this.renderRefreshAll, //plan to show all
                renderDuration = this.renderDuration, //duration
                renderOnly = this.renderOnly, //render only these alerts
                innerHeight = this.innerHeight || window.innerHeight;

            this.renderRefreshAll = this.renderDuration = false;
            this.renderOnly = false;

            //if there was no input.duration (meaning this was triggered by
            //something other than showSlide), and there's > 1 subSlide
            //meaning whe may be in the midst of showing some of the
            //information bit by bit), do nothing.

            if ((!renderRefreshAll && !renderOnly)
                    && (this.subSlides > 1)) {
                return this;
            }

            //if there is no model, set to blank.

            if (renderRefreshAll) { this.speechScript = []; }
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
                return this;
            }

            //identify what alert(s) to show

            if (renderOnly) {
                alerts = renderOnly;
            } else if (this.model.get('where')) {
                alerts = new Alerts(
                    this.model.get('collection').where(this.model.get('where'))
                );
            } else {
                alerts = this.model.get('collection');
            }

            //sort

            if (this.model.get('sortOrder')) {
                alerts.order = this.model.get('sortOrder');
                alerts.sort();
            }

            //if no alerts to display, set to blank

            if (alerts.length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
                this.subSlides = 1;
                return this;
            }

            //render each alert

            this.hasContent = true;
            html = this.template();
            this.$el.html(html);
            this.fontSize = 100;
            this.$('.alerts-list').css('fontSize', this.fontSize + '%');
            if (renderRefreshAll) {
                this.speechScript.push(this.model.get('titleText'));
            }
            alerts.each(function (x) {
                var item = new this.options.AlertView(
                    {model: x}
                );
                this.$('.alerts-list').append(item.render().$el);
                if (renderRefreshAll) {
                    this.speechScript.push(x.get('description'));
                }
            }, this);

            //shrink as needed to fit

            height = this.$el.height();
            while (this.fontSize > 1 && height > innerHeight) {
                this.fontSize -= 1;
                this.$('.alerts-list').css('fontSize', this.fontSize + '%');
                height = Math.max(this.$el.height(), 1);
            }
            if (!renderOnly) {this.lastHeight = height; }

            //if too much shrinking was necessary and conditions right to
            //make subslides, do so

            if (this.fontSize <= this.minFontSize && renderRefreshAll
                    && renderDuration && alerts.length > 0) {
                this.fontSize = 100;
                this.$('.alerts-list').css('fontSize', this.fontSize + '%');
                alerts.reduce(function (memo, alert) {
                    setTimeout(function () {
                        self.renderOnly = new Alerts(alert);
                        self.render();
                    }, memo.nextWait);
                    return {
                        nextWait: memo.nextWait + memo.eachDuration,
                        eachDuration: memo.eachDuration
                    };
                }, {nextWait: 0, eachDuration: renderDuration / alerts.length});
                self.subSlides = alerts.length;
            } else {
                if (renderRefreshAll) {
                    self.subSlides = 1;
                }
            }

            return this;
        },
    });


    return AlertsView;
});
