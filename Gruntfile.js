/*global module:false*/
require('babel-core/register');
var _ = require('lodash');
module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    karma: {
      unit: {
        configFile: 'karma.conf.js'
      },
      continuous: {
        configFile: 'karma.conf.js',
        singleRun: true,
        autoWatch: false
      }
    }
  });

  grunt.loadNpmTasks('grunt-karma');

};
