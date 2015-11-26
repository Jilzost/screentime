/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/AlertsView
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/alerts.html'
], function ($, _, Backbone, alertsTemplate) {
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
            var html;
            this.speechScript = [];
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
//NB remains to be seen if 0 is the right value
//had been "offsetHeight" in earlier version but that's not available
                return this;
            }
            this.hasContent = true;
            html = this.template();
            this.$el.html(html);
            this.fontSize = 100;
            this.$('.alerts-list').css('fontSize', this.fontSize + '%');
            this.speechScript.push(this.model.get('titleText'));
            this.model.get('collection').each(function (x) {
                var item = new this.options.AlertView(
                    {model: x}
                );
                this.$('.alerts-list').append(item.render().$el);
                this.speechScript.push(x.get('description'));
            }, this);

//FUTURE WORK the +23 is a hack to account for the margin at the bottom of the 
//last alert; should be fixed
////Had been "offsetHeight" in an earlier version but 
///that didn't seem to translate
            this.lastHeight = this.$el.height() + 23;
//NB remains to be seen if 23 is the right value
//had been "offsetHeight" in earlier version but that's not available
            while (this.fontSize > 1 && this.lastHeight > window.innerHeight) {
                this.fontSize -= 1;
                this.$('.alerts-list').css('fontSize', this.fontSize + '%');
                this.lastHeight = Math.max(this.$el.height(), 1);
            }
            return this;
        },
    });


    return AlertsView;
});
