#!/usr/bin/env node
'use strict';

var _ = require('lodash');
var chalk = require('chalk');
var dlog = require('debug')('pivotal');
var child_process = require('child_process');
var parseArgs = require('minimist')
var readline = require('readline');
var util = require('util');

var Promise = require('bluebird');
var request = require("request");

var Err = chalk.red.bold;

var argv = parseArgs(process.argv.slice(2));

var pivotalConfig = {
  project: null,
  token: null,
  label: null,
  states: 'unscheduled,unstarted,planned'
};

var pivotalIdentity;

var branch_type = undefined;

function execCommand(cmd) {
  return new Promise(function (resolve, reject) {
    dlog('execCommand started:', cmd);
    child_process.exec(cmd, function (err, stdout, stderr) {
      if (err) {
        var message = util.format('Command <%s> failed with status code:%d.\nstderr:\n%s\n', cmd, err.code, stderr);
        reject(new Error(message));
      }
      else {
        dlog('execCommand finished:', cmd);
        resolve([stdout, stderr]);
      }
    });
  });
}

function getPivotalConfig() {
  var cmd = 'git config --get-regexp "pivotal\.(token|project|label|states)"';
  return execCommand(cmd)
    .then(function (outAndErr) {
      var lines = outAndErr[0].split('\n');
      lines = lines.map(function (line) { return line.trim(); });

      _.forEach(lines, function (line) {
        if (line.length===0)
          return;
        var parts = line.match(/(\w+)\s+(.+)/);
        if (!parts || parts.length !== 3)
          return;
        var name = parts[1];
        var value = parts[2];
        pivotalConfig[name] = value;
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

  dlog('apiRequest started:', opts);

  return new Promise(function (resolve, reject) {
    request(opts, function(err, httpIncoming, body) {
      if (err) {
        reject(err);
      } else {
        resolve(body);
      }
    });
  });
}

function getIdentity() {
  dlog('getMe');
  var options = {
    url: 'https://www.pivotaltracker.com/services/v5/me'
  };
  return apiRequest('/me', options, 'get')
    .then(function (result) {
      dlog('get /me request returned result:', result);
      pivotalIdentity = result;
      return result;
    });
}

function getStories() {
  dlog('getStories.');
  var story_types = ['chore', 'feature', 'bug'];
  var states = pivotalConfig.states.split(',');

  if (argv.started) {
    states.push('started');
  }

  if (argv.chore || argv.feature || argv.bug) {
    story_types = _.filter(story_types, function (value) { return argv[value]; });
  }
  if (argv.unscheduled || argv.unstarted || argv.started) {
    states = _.filter(states, function (value) { return argv[value]; });
  }

  var fields = ['id', 'name', 'estimate', 'labels'];
  if (story_types.length === 1)
    branch_type = story_types[0];
  else
    fields.push('story_type');
  if (states.length > 1)
    fields.push('current_state');

  var labelExpr = '';
  if (_.isString(argv.label) || _.isString(pivotalConfig.label)) {
    var label = argv.label || pivotalConfig.label;
    dlog('Got label expression:<%s>', label);

    var terms = label.split(',');
    terms = _.map(terms, function(term) {
      if (term[0] === '!') {
        return util.format('-label:"%s"', term.slice(1));
      } else {
        return util.format('label:"%s"', term);
      }
    });

    labelExpr = terms.join(' ');
    dlog('Label search expression:', labelExpr);
  }

  var path = util.format('stories?filter=state:%s story_type:%s %s', states.join(), story_types.join(), labelExpr);
  return apiRequest(path)
    .then(function (result) {
      dlog(result);
      var stories = _.map(result, function (e) {
        var story = _.pick(e, fields);
        story.labels = _.map(story.labels, function (labelObj) {
          return labelObj.name;
        });
        return story;
      });

      return stories;
    });
}

function setStoryStarted(story) {
  dlog('setStoryStarted:', story);
  var path = 'stories/' + story.id;
  var options = {
    body: { current_state: 'started', owner_ids: [ pivotalIdentity.id ] }
  };
  return apiRequest(path, options, 'put')
    .then(function (result) {
      dlog('put request returned result:', result);
      return result;
    });
}

function sortStories(stories) {
  return new Promise(function (resolve, reject) {
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
    resolve(stories.sort(compare));
  });
}

function listStories(stories) {
  return new Promise(function (resolve, reject) {
    dlog('listStories.');
    if (stories.length === 0) {
      return reject(new Error('No unstarted stories found.'));
    }
    process.stdout.write('\n');
    var G = chalk.gray;
    _.forEach(stories, function(story, index) {
      var line = util.format('%s. %s', index+1, story.name);
      if (story.story_type || story.current_state) {
        var extras = [];
        if (story.story_type) extras.push(story.story_type);
        if (story.current_state) extras.push(story.current_state);
        if (story.story_type === 'feature' || branch_type === 'feature') {
          if (_.isUndefined(story.estimate))
            extras.push(chalk.red('UNESTIMATED'));
          else
            extras.push(chalk.green(story.estimate + 'pts'));
        }
        line = line + util.format(' (%s)', extras.join());
        if (story.labels.length > 0) {
          var labels = _.map(story.labels, function(l) { return chalk.blue(l); }).join(',');
          line = line + util.format(' [%s]', labels);
        }
      }
      process.stdout.write(line + '\n');
    });
    resolve(stories);
  });
}

function chooseStory(stories) {
  return new Promise(function (resolve, reject) {
    dlog('chooseStory.');
    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('\nEnter # of story to work on: ', function (answer) {
      rl.close();
      var index = parseInt(answer, 10);
      if (index>=1 && index<=stories.length) {
        var story = stories[index-1];
        dlog('chooseStory index, story:', index, story);
        if ((story.story_type === 'feature' || branch_type === 'feature') && _.isUndefined(story.estimate)) {
          console.error(Err('Features must be estimated before they can be started.'));
          reject(null);
        }
        else {
          resolve(story);
        }
      }
      else {
        dlog('chooseStory parseInt returned bad index:', index);
        dlog('chooseStory answer was:', answer);
        console.log('Changed your mind??');
        reject(null);
      }
    });
  });
}

function makeBranchNameForStory(story) {
  dlog('makeBranchNameForStory with story:', story);
  var branchType = story.story_type || branch_type;
  var branch = branchType + '/' + story.name.replace(/\W+/g, '-', 'g') + '_' + story.id;
  return branch;
}

function createBranch(branch) {
  dlog('createBranch:', branch);
  var cmd = 'git checkout -b ' + branch;
  process.stdout.write('\n' + chalk.gray.bold(cmd) + '\n');
  return execCommand(cmd)
    .then(function (outAndErr) {
      _.forEach(outAndErr, process.stdout.write.bind(process.stdout));
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
    '\tgit pivotal start <options> [storyid]',
    '\tgit pivotal bump',
    '\tgit pivotal done <storyid>',
    '',
    B('DESCRIPTION'),
    '\tThis command facilitates using Git with Pivotal Tracker.',
    '',
    '\tUse the start subcommand to choose a story to begin work on. It starts the story in Pivotal Tracker',
    '\tand creates an appropriately named branch in your local git repository.',
    '\tYou can start a specific story by optionally specifying the story id on the command line.',
    '\tIf no story id is specified, you\'ll be prompted to choose from a list of stories matching the filter options.',
    '',
    '\tUse the bump subcommand to create a new branch for the current story, in preparation for rebasing.',
    '\tThe first time this is done, it appends ".v1" to the story name. On second and subsequent bumps',
    '\tthe version numbers is bumped: .v2, .v3, etc.',
    '\tThe bump subcommand does not change pivotal state.',
    '',
    '\tUse the done command after your story is merged to delete all branches associated with the story',
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
    '\t    If any of these three options are specified, search only for stories of the given states.',
    '\t    By default, search for unstarted (backlog) and unscheduled (icebox) stories, though the default',
    '\t    may be overridden by setting the git config variable pivotal.states.',
    '',
    '\t--label=<label expression>',
    '\t    Return only stories that match the given `label expression`.',
    '\t    An expression is one or more label terms, separated by commas.',
    '\t    A label term is either a simple label, or a label prefixed with a ! character, to exclude labels.',
    '\t    Note that a default label expression can be specified, see below.',
    '',
    B('CONFIGURATION'),
    '\tYou must set two git configuration variables:',
    '\t    pivotal.token    Your personal API TOKEN from your Pivotal Tracker proile.',
    '\t    pivotal.project  The project number of the Pivotal Tracker project. This is the number',
    '\t                     that appears in the URL when viewing your project, e.g. the NNNNNNN in',
    '\t                     https://www.pivotaltracker.com/n/projects/NNNNNNN.',
    '\tYou may optionally set:',
    '\t    pivotal.label    A default label that will be used as if it were provided with --label',
    '\t                     when --label=<label> is not specified on the command line.',
    '\t    pivotal.states   A comma separate string of default story states to filter.',
    '\t                     See the section on Story State in https://www.pivotaltracker.com/help/faq#howcanasearchberefined',
    '\t                     for the states that can be specified.',
    ''
  ];

  process.stdout.write(usage.join('\n')+'\n');
}

function selectStory() {
  if (argv._.length === 2) {
    var storyId = argv._[1];
    dlog('Story id on command line:', storyId);

    var path = 'stories/' + storyId;
    return apiRequest(path)
      .then(function(story) {
        dlog('Got story:', story);
        return story;
      });

  } else {
    dlog('Choosing stories from filtered list');
    return getStories()
      .then(sortStories)
      .then(listStories)
      .then(chooseStory);
  }
}

function startStory() {
  return getPivotalConfig()
    .then(getIdentity)
    .then(selectStory)
    .then(setStoryStarted)
    .then(makeBranchNameForStory)
    .then(createBranch)
    .catch(function (err) {
      if (err) {
        console.error(Err(err));
        console.error(err.stack);
      }
    });
}

function getNewBranchName() {
  var cmd = 'git symbolic-ref --short HEAD';
  return execCommand(cmd)
    .then(function (outAndErr) {
      var lines = outAndErr[0].split('\n');
      var branch = lines[0];
      dlog('getNewBranchName: current branch is:', branch);

      var m = /^(.+)_(\d+)(\.v(\d+))?$/.exec(branch);
      if (!m) {
        return Promise.reject('Could not parse branch name:' + branch);
      }

      if (!m[3]) {
        m[4] = 1;
      } else {
        m[4] = parseInt(m[4]) + 1;
      }

      branch = m[1] + '_' + m[2] + '.v' + m[4];
      dlog('getNewBranchName: bumped branch is:', branch);

      return branch;
    })
    .catch(function (err) {
      throw(new Error('Could not get branch name.'));
    });
}


function bumpBranch() {
  return getNewBranchName()
    .then(createBranch)
    .catch(function (err) {
      if (err) {
        console.error(Err(err));
        console.error(err.stack);
      }
    });
}

function getAllBranchVersions(id) {
  const cmd = `git branch --list '*_${id}*'`;
  return execCommand(cmd)
    .then(function (outAndErr) {
      const lines = outAndErr[0].split('\n');
      const branches = _(lines).map((b) => b.trim()).compact().value();
      return branches;
    });
}

function switchToMaster() {
  const cmd = 'git checkout master';
  return execCommand(cmd);
}

function removeBranches(branches) {
  if (branches.length === 0) {
    console.log('No branches matching that story id');
  } else {
    const cmd = 'git branch -D ' + branches.join(' ');
    return execCommand(cmd);
  }
}

function doneStory(id) {
  return switchToMaster()
  .then(() => getAllBranchVersions(id))
  .then((branches) => removeBranches(branches));
}

if (argv.h || argv.help) {
  help();
}
else if (argv._[0] === 'start') {
  startStory().done();
}
else if (argv._[0] === 'bump') {
  bumpBranch().done();
}
else if (argv._[0] === 'done') {
  doneStory(argv._[1]).done();
}
else {
  help();
}
