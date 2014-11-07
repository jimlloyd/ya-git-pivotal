ya-git-pivotal
==============

Yet Another Git Extension for Pivotal Tracker

This is a node.js package that implements a git subcommand for integration with Pivotal Tracker.
It currently does only one thing: allow you to pick a story to start work on, which triggers two actions:
mark the story started in Pivotal, and create a feature branch. Maybe it will do more someday.

Other node.js packages exist that also integrate with Pivotal Tracker. You quite possibly
want to use one of them instead of this package:

### Pivotal client libraries

* [pivotaltracker][]  (v5 API)
* [pivotaljs][] (v5 API)
* [pivotal][] (v3 API)

### Git-Pivotal Integration

* [pivotal-git][] (v3 API using [pivotal][]).

# Installation

```
npm install -g ya-git-pivotal
```

# Usage

```
$ git pivotal
NAME
	git-pivotal - Pivotal Tracker integration

SYNOPSIS
	git pivotal start [--feature] [--chore] [--bug] [--unstarted] [--unscheduled]

	(That's all for now. Other commands and options may be added at a later date.)

DESCRIPTION
	Ths command facilitates using Git with Pivotal Tracker. Currently just one subcommands is provided:
	git pivotal start. Use the start subcommand to choose a story to begin work on. This starts
	the story in Pivotal Tracker and creates a feature branch in your local git repository.

OPTIONS
	--feature
	--chore
	--bug
	    By default, search for feature, chore, and bug story types.
	    If any of these three options are specified, search only for stories of the given type.

	--unstarted
	--unscheduled
	    By default, search for unstarted and unscheduled stories.
	    If any of these two options are specified, search only for stories in the given state.

CONFIGURATION
	You must set two git configuration variables:
	    pivotal.token    Your personal API TOKEN from your Pivotal Tracker proile.
	    pivotal.project  The project number of the Pivotal Tracker project. This is the number
	                     that appears in the URL when viewing your project, e.g. the NNNNNNN in
	                     https://www.pivotaltracker.com/n/projects/NNNNNNN.
```

[pivotaltracker]: https://www.npmjs.org/package/pivotaltracker
[pivotaljs]: https://www.npmjs.org/package/pivotaljs
[pivotal]: https://www.npmjs.org/package/pivotal
[pivotal-git]: https://www.npmjs.org/package/pivotal-git
