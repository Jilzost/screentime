/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Routes
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/AgencyComponents',
    'models/Route'
], function ($, _, Backbone, AgencyComponents, Route) {
    var Routes = AgencyComponents.extend({
        model: Route,
        comparator: 'sortOrder',
        maxAge: 86400000
    });

    return Routes;
});
