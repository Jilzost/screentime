/*jslint node:true */
'use strict';

var http = require('http');
var logger = require('./logger');
var fileRequestHandlers = require("./fileRequestHandlers");
var fs = require('fs');

var lastSave = Date.now();
var saveFrequency = 600000; // How often saved to disk
var samplestats = [];
var samplepages = [];

if (fs.existsSync('samples/samples.json')) {
    fs.readFile('samples/samples.json', function (err, data) {
        var i;
        if (err) {
            logger.log('server', 'server', 1,
                'sampleHandlers', 'could not load samples/samples.json');
        } else {
            samplestats = JSON.parse(data);
            for (i = 0; i < samplestats.length; i += 1) {
                samplepages[i] = samplestats[i].content;
            }
        }
    });
} else {
    logger.log('server', 'server', 5,
        'sampleHandlers', 'starting new samples/samples.json');
}

var samplepages = [];

var asDate = function (datetime) {
    var dt, yyyy, mm, dd;

    dt = new Date(datetime);
    yyyy = dt.getFullYear();
    mm = dt.getMonth() + 1;
    if (mm < 10) {mm = '0' + mm; }
    dd = dt.getDate();
    if (dd < 10) {dd = '0' + dd; }

    return yyyy + '-' + mm + '-' + dd;
};

var SampleStat = function (samplePageData) {
    this.sign = samplePageData.sign;
    this.serverId = samplePageData.serverId;
    this.countSinceLastShared = samplePageData.countSinceLastShared;
    this.lastShown = samplePageData.lastShown;
};

var SampleStat = function (sign, localId, serverId, content, firstShown, lastShown, lastShared, count, countSinceLastShared) {
    this.sign = sign;
    this.localId = localId;
    this.serverId = serverId || -1;
    this.content = content;
    this.firstShown = firstShown;
    this.lastShown = lastShown;
    this.lastShared = lastShared;
    this.count = count;
    this.countSinceLastShared = countSinceLastShared;
};

function rotateFile() {
    try {
        if (fs.existsSync('samples/samples.json')) {
            if (fs.existsSync('samples/samplesBackup.json')) {
                fs.unlinkSync('samples/samplesBackup.json');
            }
            fs.renameSync('samples/samples.json', 'samples/samplesBackup.json');
        }
        if (!fs.existsSync('samples')) {
            fs.mkdirSync('samples');
        }
        fs.appendFileSync('samples/samples.json', JSON.stringify(samplestats));
    } catch (err) {
        logger.log('server', 'server', 3,
            'sampleHandlers.rotateFile', 'Failed: ' + err);
    }
}

function newSamplePage(pathname, id, response, postData) {
    var samplePageData, index;
    try {
        samplePageData = JSON.parse(postData);

        if (samplePageData.serverId === -1) {
            index = samplepages.indexOf(samplePageData.content);
            if (index === -1) {
                samplepages.push(samplePageData.content);
                index = samplepages.indexOf(samplePageData.content);
                samplePageData.serverId = index;
                samplePageData.firstShown = new Date(samplePageData.firstShown);
                samplePageData.lastShown = new Date(samplePageData.lastShown);
                samplestats[index] = samplePageData;
            } else {
                samplestats[index].count += samplePageData.countSinceLastShared;
                samplePageData.lastShown = new Date(samplePageData.lastShown);
                if (samplePageData.lastShown > samplestats[index].lastShown) {
                    samplestats[index].lastShown = samplePageData.lastShown;
                }
            }
        }

        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write(JSON.stringify(index));
        response.end();

        if (lastSave + saveFrequency < Date.now()) {
            lastSave = Date.now();
            setTimeout(function () {rotateFile(); }, 1000);
        }
    } catch (err) {
        logger.log('server', id, 3,
            'sampleHandlers.newSamplePage', 'Failed: ' + err);
    }
}

function newSampleStat(pathname, id, response, postData) {
    var sampleStat;
    try {
        sampleStat = JSON.parse(postData);

        if (samplestats.hasOwnProperty(sampleStat.serverId)) {
            samplestats[sampleStat.serverId].count += sampleStat.countSinceLastShared;
            sampleStat.lastShown = new Date(SampleStat.lastShown);
            if (sampleStat.lastShown > samplestats[sampleStat.serverId].lastShown) {
                samplestats[sampleStat.serverId].lastShown += sampleStat.lastShown;
            }
            response.writeHead(200, {"Content-Type": "text/plain"});
            response.write(JSON.stringify('ok'));
            response.end();
        } else {
            response.writeHead(200, {"Content-Type": "text/plain"});
            response.write(JSON.stringify(-1));
            response.end();
            logger.log('server', sampleStat.sign, 3,
                'sampleHandlers.newSampleStat',
                'Unrecognized serverId ' + sampleStat.serverId, new Date(),
                new Date());
        }
    } catch (err) {
        logger.log('server', id, 3,
            'sampleHandlers.newSampleStat', 'Failed: ' + err);
    }
}

function showSamples(pathname, id, response, postData) {
    var i, responseHtml;

    try {
        responseHtml = "<!DOCTYPE html>" +
            "<html lang='en'>" +
            "<head>" +
            "<title>Screentime Samples</title>" +
            "</head>" +
            "<body style='font-size: 250%'>";

        responseHtml += "<table>" + "<tbody>";

        responseHtml += "<tr>" +
            "<th>" + "ID" + "</th>" +
            "<th>" + "First" + "</th>" +
            "<th>" + "Last" + "</th>" +
            "<th>" + "Count" + "</th>" +
            "</tr>";

        for (i = samplestats.length - 1; i >= 0; i -= 1) {
            responseHtml +=
                "<tr>" +
                "<td>" +
                '<a href = "/sample?id=' + samplestats[i].serverId + '">' +
                samplestats[i].serverId + "</a>" + "</td>" +
                "<td>" + asDate(samplestats[i].firstShown) + "</td>" +
                "<td>" + asDate(samplestats[i].lastShown) + "</td>" +
                "<td>" + samplestats[i].count + "</td>" +
                "</tr>";
        }

        responseHtml += "</tbody>" + "</table>" + "</body>" + "</html>";

        fileRequestHandlers.returnFile(response, 'samples.html', responseHtml);
    } catch (err) {
        logger.log('server', id, 3,
            'sampleHandlers.showSamples', 'Failed: ' + err);
        fileRequestHandlers.send500(response);
    }
}

function showSample(pathname, id, response, postData) {
    var index = JSON.parse(id);
    if (samplestats.hasOwnProperty(index)) {
        fileRequestHandlers.returnFile(response, 'sample' + id + '.html',
            samplestats[index].content);
    } else {
        fileRequestHandlers.send404(response);
    }
}

exports.newSamplePage = newSamplePage;
exports.newSampleStat = newSampleStat;
exports.showSample = showSample;
exports.showSamples = showSamples;