/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/speech/speechUtteranceChunker.js
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var speechUtteranceChunker = function (utt, settings, callback) {

        var newUtt, txt, chunk, x, chunkLength, pattRegex, chunkArr;
        settings = settings || {};
        txt = (settings && settings.offset !==
            undefined ? utt.text.substring(settings.offset) : utt.text);
        if (utt.voice && utt.voice.voiceURI === 'native') { // Not part of the spec
            newUtt = utt;
            newUtt.text = txt;
            newUtt.addEventListener('end', function () {
                if (speechUtteranceChunker.cancel) {
                    speechUtteranceChunker.cancel = false;
                }
                if (callback !== undefined) {
                    callback();
                }
            });
        } else {
            chunkLength = (settings && settings.chunkLength) || 160;
            pattRegex = new RegExp('^[\\s\\S]{' + Math.floor(chunkLength / 2) + ','
                + chunkLength + '}[.!?,]{1}|^[\\s\\S]{1,' + chunkLength
                + '}$|^[\\s\\S]{1,' + chunkLength + '} ');
            chunkArr = txt.match(pattRegex);

            if (chunkArr[0] === undefined || chunkArr[0].length <= 2) {
                //call once all text has been spoken...
                if (callback !== undefined) {
                    callback();
                }
                return;
            }
            chunk = chunkArr[0];
            newUtt = new SpeechSynthesisUtterance(chunk);
            newUtt.voice = speechSynthesis.getVoices().filter(function(voice) { return voice.name == 'Alex'; })[0];

            for (x in utt) {
                if (utt.hasOwnProperty(x) && x !== 'text') {
                    newUtt[x] = utt[x];
                }
            }
            newUtt.addEventListener('end', function () {
                if (this.cancel) {
                    this.cancel = false;
                    return;
                }
                settings.offset = settings.offset || 0;
                settings.offset += chunk.length - 1;
                speechUtteranceChunker(utt, settings, callback);
            });
        }

        if (settings.modifier) {
            settings.modifier(newUtt);
        }
        console.log(newUtt);
        //IMPORTANT!! Do not remove:
        //Logging the object out fixes some onend firing issues.
        //placing the speak invocation inside a callback fixes
        //ordering and onend issues.
        setTimeout(function () {
            speechSynthesis.speak(newUtt);
        }, 0);
    };
    return speechUtteranceChunker;
});
