/*jslint node:true */
'use strict';

var http = require('http');
var logger = require('./logger');
var fileRequestHandlers = require("./fileRequestHandlers");
var fs = require('fs');

var lastSave = Date.now();
var saveFrequency = 15000; // How often saved to disk
var speechsamples = [];
var utterancesamples = [];

if (fs.existsSync('speechsamples/speechsamples.json')) {
    fs.readFile('speechsamples/speechsamples.json', function (err, data) {
        if (err) {
            logger.log('server', 'server', 1,
                'speechSampleHandlers',
                'could not load speechsamples/speechsamples.json');
        } else {
            speechsamples = JSON.parse(data).speechsamples;
            utterancesamples = JSON.parse(data).utterancesamples;
        }
    });
} else {
    logger.log('server', 'server', 5,
        'sampleHandlers',
        'starting new speechsamples/speechsamples.json');
}

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

function rotateFile() {
    try {
        if (fs.existsSync('speechsamples/speechsamples.json')) {
            if (fs.existsSync('speechsamples/speechsamplesBackup.json')) {
                fs.unlinkSync('speechsamples/speechsamplesBackup.json');
            }
            fs.renameSync('speechsamples/speechsamples.json',
                'speechsamples/speechsamplesBackup.json');
        }
        if (!fs.existsSync('speechsamples')) {
            fs.mkdirSync('speechsamples');
        }
        fs.appendFileSync('speechsamples/speechsamples.json',
            JSON.stringify({
                speechsamples: speechsamples,
                utterancesamples: utterancesamples
            }));
    } catch (err) {
        logger.log('server', 'server', 3,
            'speechSampleHandlers.rotateFile', 'Failed: ' + err);
    }
}

function newSpeechSample(pathname, id, response, postData) {
    var speechsample, i;

    try {
        speechsample = JSON.parse(postData);

        speechsamples.push(speechsample);

        for (i = 0; i < speechsample.utterances.length; i += 1) {
            if (utterancesamples.indexOf(speechsample.utterances[i]) === -1) {
                utterancesamples.push(speechsample.utterances[i]);
            }
        }

        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write(JSON.stringify('ok'));
        response.end();

        if (lastSave + saveFrequency < Date.now()) {
            lastSave = Date.now();
            setTimeout(function () {rotateFile(); }, 1000);
        }
    } catch (err) {
        logger.log('server', id, 3,
            'speechSampleHandlers.newSpeechSample', 'Failed: ' + err);
    }
}

function showSamples(pathname, id, response, postData) {
    var i, j, responseHtml;



    try {
        responseHtml = "<!DOCTYPE html>" +
            "<html lang='en'>" +
            "<head>" +
            "<title>Screentime Speech Samples</title>" +
            "</head>" +
            "<body>";

        responseHtml += "<h1>" + "Speeches" + "</h1>";

        responseHtml += "<table>" + "<tbody>";

        responseHtml += "<tr>" +
            "<th>" + "ID" + "</th>" +
            "<th>" + "Sign" + "</th>" +
            "<th>" + "Time" + "</th>" +
            "<th>" + "Speech" + "</th>" +
            "</tr>";

        for (i = speechsamples.length - 1; i >= 0; i -= 1) {
            responseHtml +=
                "<tr>" +
                "<td>" +
                '<a href = "/speechsample?id=' + i + '">' +
                i + "</a>" + "</td>" +
                "<td>" + speechsamples[i].sign + "</td>" +
                "<td>" + asDate(speechsamples[i].timestamp) + "</td>" +
                "<td>";

            for (j = 0; j < speechsamples[i].utterances.length; j += 1) {
                responseHtml += speechsamples[i].utterances[j] + '<br>';
            }

            responseHtml += "</td>" + "</tr>";
        }
        responseHtml += "</tbody>" + "</table>";

        responseHtml += "<h1>" + "Utterances" + "</h1>";
        responseHtml += "<table>" + "<tbody>";
        responseHtml += "<tr>" +
            "<th>" + "ID" + "</th>" +
            "<th>" + "Utterance" + "</th>" +
            "</tr>";

        for (i = utterancesamples.length - 1; i >= 0; i -= 1) {
            responseHtml +=
                "<tr>" +
                "<td>" +
                '<a href = "/utterancesample?id=' + i + '">' +
                i + "</a>" + "</td>" +
                "<td>" + utterancesamples[i] + "</td>" + "</tr>";
        }

        responseHtml  += "</tbody>" + "</table>" + "</body>" + "</html>";

        fileRequestHandlers.returnFile(response, 'speechsamples.html', responseHtml);
    } catch (err) {
        logger.log('server', id, 3,
            'speechSampleHandlers.showSamples', 'Failed: ' + err);
        fileRequestHandlers.send500(response);
    }
}

function showSample(pathname, id, response, postData) {
    fileRequestHandlers.send404(response);
}

exports.newSpeechSample = newSpeechSample;
exports.showSample = showSample;
exports.showSamples = showSamples;