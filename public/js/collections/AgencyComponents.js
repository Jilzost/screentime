/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/AgencyComponents
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent'
], function ($, _, Backbone, AgencyComponent) {
    var AgencyComponents = Backbone.Collection.extend({

        model: AgencyComponent,
        agency: {},
        sourceType: '', //supported: MBTA-realtime
                        //FUTURE WORK validate role
        url: '',
        maxAge: 30000,
        lastUpdated: 0,
        comparator: 'sortOrder'
    });

    return AgencyComponents;
});
