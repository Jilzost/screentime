/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/V3Source
define([
    'jquery',
    'underscore',
    'backbone',
    'models/V3Model'
], function ($, _, Backbone, V3Model) {
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

    var V3Source = Backbone.Collection.extend({
        model: V3Model,
        nests: [],
        sourceType: 'V3-API',
        parse: function (data) {
            var items = [], parsed = [], included;

            items = data.data;
            included = data.included;

            parsed = _(items).map(function (item) {
                var newitem = _.defaults(
                        item.attributes,
                        _(item).omit('attributes')
                    );
                _(newitem.relationships).each(function (relCategory) {
                    _(relCategory.data).each(function (relationship) {
                        var reference = _(included).findWhere(relationship);
                        if (reference) {relationship.attributes = reference.attributes; }
                    });
                });
                return newitem;
            });

            if (this.extraProperties) {
              parsed = _(parsed).map(function (target) {
                return _.defaults(target, this.extraProperties);
              }, this);
            }
            return parsed;
        }
    });

    return V3Source;
});
