# ya-git-pivotal

Yet Another Git Extension for Pivotal Tracker

This is a node.js package that implements a git subcommand for integration with Pivotal Tracker.
It currently provides only the subcommnad 'start', which allow you to pick a story to start work on.
Starting a story triggers two actions:

1. mark the story started in Pivotal
2. create a feature branch.

## Installation

```
npm install -g ya-git-pivotal
```

## Usage

```
$ git pivotal
NAME
	git-pivotal - Pivotal Tracker integration

SYNOPSIS
	git pivotal start <options>

	(That's all for now. Other commands and options may be added at a later date.)

DESCRIPTION
	This command facilitates using Git with Pivotal Tracker. Currently just one subcommand is provided:
	git pivotal start. Use the start subcommand to choose a story to begin work on. This starts
	the story in Pivotal Tracker and creates an appropriately named branch in your local git repository.

OPTIONS
	--feature
	--chore
	--bug
	    If any of these three options are specified, search only for stories of the given types.
	    By default, include all three types.

	--unstarted
	--unscheduled
	--started
	    If any of these three options are specified, search only for stories of the given states.
	    By default, search for unstarted (backlog) and unscheduled (icebox) stories.

	--label=<label>
	    Search only for stories with the given label.
	    Note that a default label can be specified, see below.

CONFIGURATION
	You must set two git configuration variables:
	    pivotal.token    Your personal API TOKEN from your Pivotal Tracker proile.
	    pivotal.project  The project number of the Pivotal Tracker project. This is the number
	                     that appears in the URL when viewing your project, e.g. the NNNNNNN in
	                     https://www.pivotaltracker.com/n/projects/NNNNNNN.
	You may optionally set:
	    pivotal.label    A default label that will be used as if it were provided with --label
	                     when --label=<label> is not specified on the command line.
```

## Other similar packages

Other NPM packages exist that also integrate with Pivotal Tracker. If this simple package doesn't meet your needs you may
want to use one of them instead:

### Pivotal client libraries

* [pivotaltracker][]  (v5 API)
* [pivotaljs][] (v5 API)
* [pivotal][] (v3 API)

### Git-Pivotal Integration

* [pivotal-git][] (v3 API using [pivotal][]).


[pivotaltracker]: https://www.npmjs.org/package/pivotaltracker
[pivotaljs]: https://www.npmjs.org/package/pivotaljs
[pivotal]: https://www.npmjs.org/package/pivotal
[pivotal-git]: https://www.npmjs.org/package/pivotal-git
