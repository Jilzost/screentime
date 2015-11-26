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
    'helper/speech/speechUtteranceChunker'
], function ($, _, Backbone, mespeak, io, speechUtteranceChunker) {
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
            var textList = [], self = this;
            console.log('startStop triggered');
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
                textList = textList.concat(v.speechScript);
            });
            self.speakTextList(textList);
        },
        speakTextList: function (textList, i) {
            var utterance, testval, self = this;
            i = i || 0;
            if (i < 0) { i = 0; }
            if (self.get('voiceTools') === 'mespeak') {
                if (self.get('haltSpeech')) {
                    self.set({'haltSpeech': false});
                    self.set({'speakingState': false});
                    return;
                }
                if (i < textList.length) {
                    self.set({'speakingState': true});
                    testval = meSpeak.speak(textList[i], {},
                            function () {
                            self.speakTextList(textList, i + 1);
                        });
                } else {
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


