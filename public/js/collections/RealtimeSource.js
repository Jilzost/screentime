/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/RealtimeSource
define([
    'jquery',
    'underscore',
    'backbone',
    'models/RealtimeModel'
], function ($, _, Backbone, RealtimeModel) {
    var unnest = function (nested, levels) {
        return _(levels).reduce(function (input, target) {
            var output = [];
            _(input).each(function (base) {
                var baseProperties;
                if (!base.hasOwnProperty(target) || !_.isArray(base[target])) {
                    return;
                }
                baseProperties = _(base).omit(target);
                _(base[target]).each(function (child) {
                    output.push(_(child).defaults(baseProperties));
                });
            });
            return output;
        }, [nested]);
    };

    var RealtimeSource = Backbone.Collection.extend({
        model: RealtimeModel,
        nests: [],
        sourceType: 'MBTA-realtime',
        parse: function (data) {
            var parsed = unnest(data, this.nests);
            if (this.extraProperties) {
              parsed = _(parsed).map(function (target) {
                return _.defaults(target, this.extraProperties);
              }, this);
            }
            return parsed;
        }
    });

    return RealtimeSource;
});
