# ya-git-pivotal

Yet Another Git Extension for Pivotal Tracker

This is a node.js package that implements a git subcommand for integration with Pivotal Tracker.

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
	git pivotal start <options> [storyid]
	git pivotal bump

DESCRIPTION
	This command facilitates using Git with Pivotal Tracker.

	Use the start subcommand to choose a story to begin work on. It starts the story in Pivotal Tracker
	and creates an appropriately named branch in your local git repository.
	You can start a specific story by optionally specifying the story id on the command line.
	If no story id is specified, you'll be prompted to choose from a list of stories matching the filter options.

	Use the bump subcommand to create a new branch for the current story, in preparation for rebasing.
	The first time this is done, it appends ".v1" to the story name. On second and subsequent bumps
	the version numbers is bumped: .v2, .v3, etc.
	The bump subcommand does not change pivotal state.

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
	    By default, search for unstarted (backlog) and unscheduled (icebox) stories, though the default
	    may be overridden by setting the git config variable pivotal.states.

	--label=<label expression>
	    Return only stories that match the given `label expression`.
	    An expression is one or more label terms, separated by commas.
	    A label term is either a simple label, or a label prefixed with a ! character, to exclude labels.
	    Note that a default label expression can be specified, see below.

CONFIGURATION
	You must set two git configuration variables:
	    pivotal.token    Your personal API TOKEN from your Pivotal Tracker proile.
	    pivotal.project  The project number of the Pivotal Tracker project. This is the number
	                     that appears in the URL when viewing your project, e.g. the NNNNNNN in
	                     https://www.pivotaltracker.com/n/projects/NNNNNNN.
	You may optionally set:
	    pivotal.label    A default label that will be used as if it were provided with --label
	                     when --label=<label> is not specified on the command line.
	    pivotal.states   A comma separate string of default story states to filter.
	                     See the section on Story State in https://www.pivotaltracker.com/help/faq#howcanasearchberefined
	                     for the states that can be specified.
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
