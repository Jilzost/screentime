/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window, meSpeak */
'use strict';

// Filename: models/Speaker
define([
    'jquery',
    'underscore',
    'backbone',
    'mespeak',
    'io',
    'helper/speech/speechUtteranceChunker',
    'helper/logger'
], function ($, _, Backbone, mespeak, io, speechUtteranceChunker, logger) {
    var Speaker = Backbone.Model.extend({
        defaults: {
            modelType: 'Speaker',
            triggerTypes: 'key', //'key' 'socket', 'key socket'
            triggerKey: 83, //83 = 's'
            signId: '',
            voiceTools: 'mespeak', //'webspeech' or 'mespeak' 
            speakingState: false,
            haltSpeech: false,
            chunkerCancel: false,
            maxChars: 50000,//mespeak experiments
            stringTogether: true, //mespeak experiments
            sign: {}
        },
        initialize: function () {
            var speechSocket, reactKey, self = this, utterance;

            this.startStop = _.bind(this.startStop, this);
            this.speakTextList = _.bind(this.speakTextList, this);

            if (this.get('triggerTypes').indexOf('key') >= 0) {
                reactKey = function (evt) {
                    if (evt.keyCode === self.get('triggerKey')) {
                        self.startStop();
                    }
                };
                document.onkeydown = function (key) { reactKey(key); };
            }

            if (self.get('triggerTypes').indexOf('socket') >= 0) {
                if (self.get('signId') === '') {
                    self.set({
                        signId: window
                            .location
                            .search
                            .replace(/[\?\&]id=([^\?\&]*)/i, '$1')
                    });
                }

                speechSocket = io.connect();

                speechSocket.on('speak', function (data) {
                    self.startStop();
                });


                speechSocket.emit('join', {newChannel: self.get('signId')});


                self.set({speechSocket: speechSocket});

            }

            if (self.get('voiceTools') === 'mespeak') {
                meSpeak.loadConfig('/js/libs/mespeak/mespeak_config.json');
                meSpeak.loadVoice('/js/libs/mespeak/voices/en/en-us.json');

            }
        },
        startStop: function () {
            var textList = [], self = this,
                splitPeriod = new RegExp(
                    '^([\\W\\w]{1,' + self.get('maxChars') + '}\\.)([\\W\\w]*)$'
                ),
                splitComma = new RegExp(
                    '^([\\W\\w]{1,' + self.get('maxChars') + '}[\\,\\:;])([\\W\\w]*)$'
                ),
                splitSpace = new RegExp(
                    '^([\\W\\w]{1,' + self.get('maxChars') + '}\\s)([\\W\\w]*)$'
                );
            if (self.get('voiceTools') ===
                    'webspeech' && speechSynthesis.speaking) {
                speechSynthesis.cancel();
                return;
            }
            if (self.get('voiceTools') ===
                    'mespeak' && self.get('speakingState')) {
                self.set({haltSpeech: true});
                return;
            }
            _([
                self.get('sign').get('screenViews').departures,
                self.get('sign').get('screenViews').currentAlerts,
                self.get('sign').get('screenViews').upcomingAlerts,
                self.get('sign').get('screenViews').elevatorAlerts
            ]).each(function (v) {
                // console.log(v.speechScript);
                // console.log(v.speechScript.join('; '));
                //textList = textList.concat(v.speechScript);//mespeak pre-experiments
                textList = textList.concat(v.speechScript.join('; '));//mespeak experiments
            });
            if (self.get('voiceTools') === 'mespeak') {
                textList = _(textList).reduce(function (memo, text) {
                    var results;
                    while (text.length > self.get('maxChars')) {
                        if (splitPeriod.test(text)) {
                            results = splitPeriod.exec(text);
                        } else if (splitComma.test(text)) {
                            results = splitComma.exec(text);
                        } else if (splitSpace.test(text)) {
                            results = splitSpace.exec(text);
                        } else {
                            text = '...';
                        }
                        memo.push(results[1]);
                        text = results[2];
                    }
                    memo.push(text);
                    return memo;
                }, []);
            }
            self.speakTextList(textList);
        },
        speakTextList: function (textList, i) {
            var utterance, testval, self = this;
            i = i || 0;
            if (i < 0) { i = 0; }
            if (self.get('voiceTools') === 'mespeak') {
                if (self.get('haltSpeech')) {
                    logger.log('models/Speaker.speakTextList', 'haltSpeech');
                    self.set({'haltSpeech': false});
                    self.set({'speakingState': false});
                    return;
                }

                if (i < textList.length) {
                    logger.log('models/Speaker.speakTextList', 'speaking '
                        + i
                        + ' of 0 to '
                        + (textList.length - 1)
                        + ': '
                        + textList[i]);
                    self.set({'speakingState': true});
                    testval = meSpeak.speak(textList[i], {},
                            function () {
                            logger.log('models/Speaker.speakTextList', 'meSpeak.speak completed');
                            self.speakTextList(textList, i + 1);
                        });
                } else {
                    logger.log('models/Speaker.speakTextList', 'setting speakingState to false');
                    self.set({'speakingState': false});

                }
                return;
            }
            if (i < textList.length) {
                utterance = new SpeechSynthesisUtterance(textList[i]);
                speechUtteranceChunker(utterance, {},
                    function () {
                        self.speakTextList(textList, i + 1);
                    });
            }
        }
    });
    return Speaker;
});


