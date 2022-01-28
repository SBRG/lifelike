// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    // Adding "files:" to fix errors as explained at:
    // https://github.com/SBRG/kg-prototypes/pull/93#issuecomment-617272392
    files: [
      { pattern: 'https://cdn.plot.ly/plotly-latest.js', watched: false },
    ],
    basePath: '',
    // The threshold for this timeout is likely to increase as we add more code to the
    // app; the time required here is directly proportional to the time it takes to
    // compile the code
    browserNoActivityTimeout: 90000,
    frameworks: ['jasmine', '@angular-devkit/build-angular', 'viewport'],
    plugins: [
      require('karma-jasmine'),
      require('karma-spec-reporter'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('@angular-devkit/build-angular/plugins/karma'),
      require('karma-viewport')
    ],
    customLaunchers: {
      ChromeCustom: {
        base: 'Chrome',
        flags: [
          '--headless',
          '--no-sandbox',
          '--remote-debugging-port=9222',
          '--remote-debugging-address=0.0.0.0',
        ],
      },
    },
    client:{
      clearContext: false, // leave Jasmine Spec Runner output visible in browser
      captureConsole: true,
    },
    coverageIstanbulReporter: {
        dir: require('path').join(__dirname, './coverage/client'),
        reports: ['html', 'lcovonly', 'text-summary'],
        fixWebpackSourcePaths: true
    },
    angularCli: {
      environment: 'dev'
    },
    reporters: ['spec', 'kjhtml'],
    specReporter: {
        maxLogLines: 5,             // limit number of lines logged per test
        suppressErrorSummary: true, // do not print error summary
        suppressFailed: false,      // do not print information about failed tests
        suppressPassed: false,      // do not print information about passed tests
        suppressSkipped: false,     // do not print information about skipped tests
        showSpecTiming: false,      // print the time elapsed for each spec
        failFast: false             // test would finish with error when a first fail occurs.
    },
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeCustom'],
    singleRun: false
  });
};
