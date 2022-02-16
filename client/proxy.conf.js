const process = require("process");

const ENVIRONMENT_CONFIG = process.env.ENVIRONMENT_CONFIG || "development";
const APPSERVER_UPSTREAM = process.env.APPSERVER_URL || "http://localhost:5000";

const PROXY_CONFIG = [
    {
        context: [
            "/api"
        ],
        "target": APPSERVER_URL,
        "secure": false,
        "pathRewrite": {
            "^/api": ""
        },
        "changeOrigin": true,
        "logLevel": "debug"
    },
    {
        context: [
            "/environment.css"
        ],
        "target": "http://localhost:4200",
        "pathRewrite": {
            "^/environment.css$": `/environments/${ENVIRONMENT_CONFIG}.css`
        },
    },
];
module.exports = PROXY_CONFIG;
