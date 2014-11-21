#!/usr/bin/env node
'use strict';

// superstack needs to be first, when used.
// Unfortunately, it seems to be incompatible with node 0.11,
// or rather using both superstack and Q.longStackSupport is incompatible with node 0.11.
// var superstack = require('superstack');
// superstack.empty_frame = '----';

var _ = require('lodash');
var chalk = require('chalk');
var dlog = require('debug')('pivotal');
var exec = require('child_process').exec;
var parseArgs = require('minimist')
var Q = require('q');
var readline = require('readline');
var request = require('request');
var util = require('util');

var Err = chalk.red.bold;

Q.longStackSupport = true;

var argv = parseArgs(process.argv.slice(2));

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var pivotalConfig = {
  project: null,
  token: null
};

var branch_type = undefined;

function execCommand(cmd) {
	dlog('execCommand:', cmd);
  var deferred = Q.defer();
  exec(cmd, function (err, stdout, stderr) {
    if (err) {
      var message = util.format('Command <%s> failed with status code:%d.\nstderr:\n%s\n', cmd, err.code, stderr);
      deferred.reject(new Error(message));
    }
    else {
      deferred.resolve([stdout, stderr]);
    }
  });
  return deferred.promise;
}

function getPivotalConfig() {
  var cmd = 'git config --get-regexp "pivotal\.(token|project)"';
  return execCommand(cmd)
    .then(function (outAndErr) {
      var lines = outAndErr[0].split('\n');
      lines = lines.map(function (line) { return line.trim(); });

      _.forEach(lines, function (line) {
        if (line.length===0)
          return;
        var words = line.split(/\s+/);
        if (words.length!==2)
          return;
        if (words[0].match(/token$/))
          pivotalConfig.token = words[1];
        else if (words[0].match(/project$/))
          pivotalConfig.project = words[1];
      });

      return pivotalConfig;
    })
    .catch(function (err) {
      throw(new Error('git config variables pivotal.token and pivotal.project must be defined.'));
    });
}

function apiRequest(path, options, method) {
  options = options || {};
  method = method || 'get';
  var baseUrl = 'https://www.pivotaltracker.com/services/v5/projects/' + pivotalConfig.project + '/';
	var opts = _.extend({
		method: method,
		url: baseUrl + path,
		json: true,
		headers: {
			'X-TrackerToken': pivotalConfig.token
		}
	}, options);

	dlog('apiRequest:', opts);

  var deferred = Q.defer();
  request(opts, function callback(err, response, body) {
    if (err)
      deferred.reject(err);
    else if (response.statusCode !== 200)
      deferred.reject(new Error(util.format('HTTP status:%d', response.statusCode)));
    else {
      deferred.resolve(body);
    }
  });
  return deferred.promise;
}

function getStories() {
  dlog('getStories.');
  var story_types = ['chore', 'feature', 'bug'];
  var states = ['unscheduled', 'unstarted'];

  if (argv.started) {
    states.push('started');
  }

  if (argv.chore || argv.feature || argv.bug) {
    story_types = _.filter(story_types, function (value) { return argv[value]; });
  }
  if (argv.unscheduled || argv.unstarted || argv.started) {
    states = _.filter(states, function (value) { return argv[value]; });
  }

  var fields = ['id', 'name'];
  if (story_types.length === 1)
    branch_type = story_types[0];
  else
    fields.push('story_type');
  if (states.length > 1)
    fields.push('current_state');

  var path = util.format('stories?filter=state:%s story_type:%s', states.join(), story_types.join());
  return apiRequest(path)
    .then(function (result) {
      dlog(result);
      var stories = _.map(result, function (e) { return _.pick(e, fields); });
      return stories;
    });
}

function setStoryStarted(story) {
  dlog('setStoryStarted:', story);
  var path = 'stories/' + story.id;
  var options = {
    body: { current_state: 'started' }
  };
  return apiRequest(path, options, 'put')
    .then(function (result) {
      dlog('put request returned result:', result);
      return result;
    })
    .catch(function (err) {
      console.error('Error setting story state to started:', Err(err.toString()));
      return story;
    });
}

function sortStories(stories) {
  dlog('sortStories.');
  function compare(a, b) {
    function fieldCompare(field) {
      if (a[field] && b[field])
        return a[field].localeCompare(b[field]);
      else
        return 0;
    }
    var cmp;
    cmp = fieldCompare('current_state');
    if (cmp !== 0)
      return -cmp;
    cmp = fieldCompare('story_type');
    if (cmp !== 0)
      return -cmp;
    cmp = fieldCompare('name');
    return cmp;
  }

  return stories.sort(compare);
}

function listStories(stories) {
  dlog('listStories.');
  if (stories.length === 0) {
    return Q.reject(new Error('No unstarted stories found.'));
  }
  rl.write('\n');
  var G = chalk.gray;
  _.forEach(stories, function(story, index) {
    var line = util.format('%s. %s', index+1, story.name);
    if (story.story_type || story.current_state) {
      var extras = [];
      if (story.story_type) extras.push(story.story_type);
      if (story.current_state) extras.push(story.current_state);
      line = line + util.format(' (%s)', extras.join());
    }
    rl.write(line + '\n');
  });
  return new Q(stories);
}

function chooseStory(stories) {
  dlog('chooseStory.');
  var deferred = Q.defer();
  rl.question('\nEnter # of story to work on: ', function (answer) {
    var index = parseInt(answer, 10);
    if (index>=1 && index<=stories.length) {
      var story = stories[index-1];
      dlog('chooseStory index, story:', index, story);
      deferred.resolve(story);
    }
    else {
      dlog('chooseStory parseInt returned bad index:', index);
      dlog('chooseStory answer was:', answer);
      deferred.reject(null);
    }
  });
  return deferred.promise;
}

function makeBranchNameForStory(story) {
  dlog('makeBranchNameForStory with story:', story);
  var branchType = story.story_type || branch_type;
  var branch = branchType + '/' + story.name.replace(/\s+/g, '-', 'g') + '_' + story.id;
  return branch;
}

function createBranch(branch) {
  dlog('createBranch:', branch);
  var cmd = 'git checkout -b ' + branch;
  rl.write('\n' + chalk.gray.bold(cmd) + '\n');
  return execCommand(cmd)
    .then(function (outAndErr) {
      _.forEach(outAndErr, rl.write.bind(rl));
      return null;
    });
}

function help() {
  var B = chalk.bold;
  var U = chalk.underline;
  var usage = [
    B('NAME'),
    '\tgit-pivotal - Pivotal Tracker integration',
    '',
    B('SYNOPSIS'),
    '\tgit pivotal start [--feature] [--chore] [--bug] [--unstarted] [--unscheduled] [--started]',
    '',
    '\t(That\'s all for now. Other commands and options may be added at a later date.)',
    '',
    B('DESCRIPTION'),
    '\tThs command facilitates using Git with Pivotal Tracker. Currently just one subcommands is provided:',
    '\t'+U('git pivotal start')+'. Use the start subcommand to choose a story to begin work on. This starts',
    '\tthe story in Pivotal Tracker and creates an appropriately named branch in your local git repository.',
    '',
    B('OPTIONS'),
    '\t--feature',
    '\t--chore',
    '\t--bug',
    '\t    If any of these three options are specified, search only for stories of the given types.',
    '\t    By default, include all three types.',
    '',
    '\t--unstarted',
    '\t--unscheduled',
    '\t--started',
    '\t    If any of these two options are specified, search only for stories of the given states.',
    '\t    By default, search for unstarted and unscheduled stories.',
    '',
    B('CONFIGURATION'),
    '\tYou must set two git configuration variables:',
    '\t    pivotal.token    Your personal API TOKEN from your Pivotal Tracker proile.',
    '\t    pivotal.project  The project number of the Pivotal Tracker project. This is the number',
    '\t                     that appears in the URL when viewing your project, e.g. the NNNNNNN in',
    '\t                     https://www.pivotaltracker.com/n/projects/NNNNNNN.',
    ''
  ];

  rl.write(usage.join('\n')+'\n');
  rl.close();
}

function startStory() {
  getPivotalConfig()
    .then(getStories)
    .then(sortStories)
    .then(listStories)
    .then(chooseStory)
    .then(setStoryStarted)
    .then(makeBranchNameForStory)
    .then(createBranch)
    .catch(function (err) {
      if (err === null)
        console.log('Changed your mind??');
      else {
        console.error(Err(err));
        console.error(err.stack);
      }
    })
    .done(function () {
      rl.close();
    });
}

if (argv.h || argv.help) {
  help();
}
else if (argv._[0] === 'start') {
  startStory();
}
else {
  help();
}
