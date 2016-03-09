/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/ScreenshotManager
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Screenshot',
    'collections/Screenshots'
], function ($, _, Backbone, Screenshot, Screenshots) {
    var ScreenshotManager = Backbone.Model.extend({

        defaults: {
            allScreenshots: new Screenshots(),
            takeScreenshots: true,
            takeScreenshotFreq: 70000,
            syncScreenshotFreq: 1200000,
            maxScreenshots: 1000,
            signId: 'sign_id_not_set'
        },
        initialize: function () {
            this.takeScreenshot = _.bind(this.takeScreenshot, this);
            this.syncScreenshot = _.bind(this.syncScreenshot, this);
            this.cleanupScreenshots = _.bind(this.cleanupScreenshots, this);

            if (!this.get('takeScreenshots')) {return; }

            setInterval(function (self) {
                return self.takeScreenshot;
            }(this), this.get('takeScreenshotFreq'));

            setInterval(function (self) {
                return self.syncScreenshot;
            }(this), this.get('syncScreenshotFreq'));
        },
        takeScreenshot: function () {
            var newShot, oldShot;
            if (this.get('allScreenshots').length
                    > this.get('maxScreenshots')) {
                this.cleanupScreenshots();
            }
            newShot = new Screenshot();
            oldShot = this.get('allScreenshots').findWhere(
                {
                    genericText: newShot.get('genericText')
                }
            );
            if (oldShot) {
                oldShot.updateCount();
                return;
            }
            newShot.set({signId: this.get('signId')});
            this.get('allScreenshots').push(newShot);
        },
        syncScreenshot: function () {
            var unsentShot;
            unsentShot = this.get('allScreenshots').findWhere({serverId: -1});
            if (unsentShot) {
                unsentShot.sync();
            }
            _(this.get('allScreenshots').where({upToDate: false})).each(
                function (x) {
                    if (x.get('serverId') >= 0) {
                        x.sync();
                    }
                }
            );
        },
        cleanupScreenshots: function () {
            var cutoff = this.get('allScreenshots').min(function (model) {
                return model.get('lastShown');
            }).get('lastShown');
            cutoff = (cutoff + Date.now()) / 2;
            this.get('allScreenshots').remove(
                this.get('allScreenshots').filter(function (x) {
                    return x.get('lastShown') > cutoff && x.get('upToDate');
                })
            );
        }
    });

    return ScreenshotManager;
});
