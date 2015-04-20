var b = {
    speech: {
        vocalize: true, // Whether vocalization is supported
        vocalizeKeyCode: 83 // key to trigger speech, 83=s
    },
    logging: {
        //destination: 'console',
        //destination: 'http://localhost:3000/', //console: log to console. Anything else: log to server. (URL not needed or supported) 
        destination: 'server',
        level: 5, //0 = none 1 = critical errors 2 = errors 3 = warnings 5 = everything
        maxEntries: 60, // Maximum number of logs that can be recorded...
        allowedEvery: 1800000, //...every X milliseconds. 
        heartbeatRate: 60000, // in ms
        sendSamples: true,
        shareSamplesEvery: 600000, //in ms; 3600000 is one hour
        maxSamples: 5000 //At this point sample list will be zero'ed out. Enter a 0 here for unlimited size. 
        sendSpeechSamples: true
    }
};