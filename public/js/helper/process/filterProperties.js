/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';



// Filename: helper/process/filterProperties.js
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var filterProperties = function (obj, name, separator) {
        var newObj, testExp, newPropName, prop;
        separator = separator || '';
        testExp = new RegExp('^' + name + separator + '(.*)');
        newObj = {};

        for (prop in obj) {
            if (obj.hasOwnProperty(prop) && testExp.test(prop)) {
                newPropName = prop.replace(testExp, '$1');
                newObj[newPropName] = obj[prop];
            }
        }
        return newObj;
    };

    return filterProperties;
});