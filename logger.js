/*jslint node:true */
'use strict';

var heartbeatHandlers = require('./heartbeatHandlers.js');
var fs = require('fs');
var nodemailer = require('nodemailer');
var cron = require('cron');
var config = require('config');
var findRemoveSync = require('find-remove');

var csvheader = '"serverTime","source","sign","sourceTime","logLevel","process","message"\r\n';
var tabheader = 'sign\tsourceTime\tprocess\tmessage\r\n';

var serverStartTime;

var logThreshold = config.get('logThreshold');
var emailThreshold = config.get('emailThreshold');
var email = config.get('emailIsOn');
if (email && config.has('emailSettings')) {
    email = config.get('emailSettings');
} else {
    email = false;
}

var logAgeSec = 60 * 60 * 24 * 31;

var baseEmailFrequency = 60000;
var currentEmailFrequency = baseEmailFrequency;
var emailContent = '';
var lastEmailSentAt = new Date(0);

var Entry = function (source, sign, logLevel, process, message, sourceTime) {
    this.logTime = new Date();
    this.source = source;
    this.sign = sign;
    this.sourceTime = sourceTime || new Date();
    this.logLevel = logLevel;
    this.process = process;
    this.message = message;
};

Entry.prototype = {
    csvrow: function () {
        return '"' +
            this.logTime + '","' +
            this.source + '","' +
            this.sign + '","' +
            this.sourceTime + '","' +
            this.logLevel + '","' +
            this.process + '","' +
            this.message + '"\r\n';
    },
    tabrow: function () {
        return this.sign + '\t' +
            this.sourceTime.getHours() +
            (this.sourceTime.getMinutes() < 10 ? ':0' : ':') +
            this.sourceTime.getMinutes() +
            (this.sourceTime.getSeconds() < 10 ? ':0' : ':') +
            this.sourceTime.getSeconds() + '\t' +
            this.process + '\t' +
            this.message + '\r\n';
    }
};

function formatDuration(ms) {
    var count, unit;
    if (ms >= 1000 * 60 * 60 * 24) {
        unit = 'day';
        count = Math.floor(ms / (1000 * 60 * 60 * 24));
    } else if (ms >= 1000 * 60 * 60) {
        unit = 'hour';
        count = Math.floor(ms / (1000 * 60 * 60));
    } else if (ms >= 1000 * 60) {
        unit = 'minute';
        count = Math.floor(ms / (1000 * 60));
    } else {
        unit = 'second';
        count = Math.floor(ms / (1000));
    }
    if (count === 1) {return 'for ' + count + ' ' + unit; }
    return 'for ' + count + ' ' + unit + 's';
}

function recordLogEntry(entry, overrideThreshold) {
    var logPath, csvrow;

    if (entry.logLevel <= logThreshold || overrideThreshold) {

        csvrow = entry.csvrow();

        logPath = 'public/log/screentime.log';

        if (fs.existsSync(logPath)) {
            fs.appendFileSync(logPath, csvrow);
        } else {
            fs.appendFileSync(logPath, csvheader + csvrow);
        }
    }
}

function sendLogEntryEmail(includedSpan) {
    var transporter, mailOptions, errorLog;

    if (!email) { return false; }

    transporter = nodemailer.createTransport(email.transport);
    mailOptions = {
        from: email.from, // sender address
        to: email.to, // list of receivers
        subject: email.subject, // Subject line
        text: emailContent + '\r\nIncludes entries from last ' +
            includedSpan / 60000 + ' minute(s).\r\n' // plaintext body
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            errorLog = new Entry('server', 'server', 2, 'logger.sendLogEntryEmail',
                'Error: ' + error);
            recordLogEntry(errorLog);
        }
    });
    emailContent = '';
}

function addLogEntryToEmail(entry, forceEmail) {
    if ((entry.logLevel <= emailThreshold) || forceEmail) {
        if (lastEmailSentAt > Date.now()) {
            emailContent += entry.tabrow();
        } else {
            if (lastEmailSentAt + currentEmailFrequency <= Date.now()) {
                currentEmailFrequency = baseEmailFrequency;
            } else {
                currentEmailFrequency += baseEmailFrequency;
            }
            lastEmailSentAt = Date.now() + currentEmailFrequency;
            setTimeout(function () {sendLogEntryEmail(currentEmailFrequency); },
                    currentEmailFrequency);
            emailContent = tabheader + entry.tabrow();
        }
    }
}

function log(source, sign, logLevel, process, message, forceEmailOptional, sourceTimeOptional) {
    forceEmailOptional = forceEmailOptional || false;
    sourceTimeOptional = sourceTimeOptional || new Date();
    var entry = new Entry(source, sign, logLevel, process, message, sourceTimeOptional);
    recordLogEntry(entry);
    addLogEntryToEmail(entry, forceEmailOptional);
}

function logUptimes() {
    log('server', 'server', 5, 'logUptimes',
            'Up ' + formatDuration(new Date() - serverStartTime), true);
    var i, times = heartbeatHandlers.getUptimes(1000 * 60 * 60 * 24 * 7);
    for (i = 0; i < times.length; i += 1) {
        if (times[i].up) {
            log('server', times[i].sign, 5, 'logUptimes',
                'Up ' + formatDuration(times[i].time), true);
        } else {
            log('server', times[i].sign, 5, 'logUptimes',
                'DOWN ' + formatDuration(times[i].time), true);
        }
    }
}

function deleteOldFiles() {
    var result,
        frOps = {
            extensions: ['.bak', '.log', '.csv'],
            age: {seconds: logAgeSec}
        };
    result = findRemoveSync('public/log', frOps);
    console.log(result);
}

function renameCurrentFile() {
    var oldLogPath, newLogPath, yyyy, mm, dd, today;

    today = new Date();
    yyyy = today.getFullYear();
    mm = today.getMonth() + 1;
    if (mm < 10) {mm = '0' + mm; }
    dd = today.getDate();
    if (dd < 10) {dd = '0' + dd; }

    oldLogPath = 'public/log/screentime.log';
    newLogPath = 'public/log/screentime-' + yyyy + '-' + mm + '-' + dd + '.log';

    if (fs.existsSync(oldLogPath) &&
            !fs.existsSync(newLogPath)) {
        fs.renameSync(oldLogPath, newLogPath);
    }
}

function startLogging() {
    var logUptimeJob = new cron.CronJob('34 56 8 * * *', function () {logUptimes(); }, null, true),
        deleteOldFilesJob = new cron.CronJob('10 28 * * * *', function () {deleteOldFiles(); }, null, true),
        renameCurrentFileJob = new cron.CronJob('50 59 23 * * *', function () {renameCurrentFile(); }, null, true);
    serverStartTime = new Date();
}

exports.formatDuration = formatDuration;
exports.log = log;
exports.startLogging = startLogging;
