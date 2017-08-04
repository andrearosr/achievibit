var _ = require('lodash');
var nconf = require('nconf');
nconf.argv().env();
var dbLibrary = nconf.get('testDB') ? 'monkey-js' : 'monk';
var monk = require(dbLibrary);
var async = require('async');
var utilities = require('./utilities');
var github = require('octonode');
var request = require('request');
var colors = require('colors');
var client = github.client({
  username: nconf.get('githubUser'),
  password: nconf.get('githubPassword')
});
var console = require('./consoleService')('achievibitDB', [
  'cyan',
  'inverse'
], process.console);

var url = nconf.get('databaseUrl');
var db = monk(url);
var apiUrl = 'https://api.github.com/repos/';

var collections = {
  repos: db.get('repos'),
  users: db.get('users'),
  // uses to store additional private user data
  userSettings: db.get('auth_users')
};

var achievibitDB = {};

initCollections();

achievibitDB.insertItem = insertItem;
achievibitDB.updateItem = updateItem;
achievibitDB.findItem = findItem;
achievibitDB.updatePartially = updatePartially;
achievibitDB.updatePartialArray = updatePartialArray;
achievibitDB.getExtraPRData = getExtraPRData;
achievibitDB.addPRItems = addPRItems;
achievibitDB.connectUsersAndRepos = connectUsersAndRepos;
achievibitDB.createAchievibitWebhook = createAchievibitWebhook;
achievibitDB.deleteAchievibitWebhook = deleteAchievibitWebhook;
achievibitDB.getAndUpdateUserData = getAndUpdateUserData;

module.exports = achievibitDB;

function initCollections() {
  collections.repos.index({ fullname: 1 }, { unique: true, sparse: true });
  collections.repos.index({
    'fullname': 'text',
    'organization': 'text'
  }, {
    'weights': {
      'fullname': 3,
      'organization': 1
    }
  });
  collections.users.index({ username: 1 }, { unique: true, sparse: true });
  collections.users.index({
    'username': 'text',
    'repos': 'text',
    'organizations': 'text'
  }, {
    'weights': {
      'username': 3,
      'repos': 1,
      'organizations': 1
    }
  });
}

function insertItem(collection, item) {
  if (_.isNil(collection) || _.isNil(item)) {return;}
  return collections[collection].insert(item)
    .then(passParam, function(error) {
      console.error([
        colors.yellow.bgMagenta('achievibitDB.insertItem'),
        ' got an error'
      ].join(''), error);

      return error;
    });
}

function updateItem(collection, identityObject, updateWith) {
  if (_.isNil(collection) || _.isNil(identityObject) || _.isNil(updateWith)) {
    return;
  }

  return collections[collection].update(identityObject, updateWith)
    .then(passParam, function(error) {
      console.error([
        colors.yellow.bgMagenta('achievibitDB.updateItem'),
        ' got an error'
      ].join(''), error);

      return error;
    });
}

function updatePartially(collection, identityObject, updatePartial) {
  if (_.isNil(collection) ||
    _.isNil(identityObject) ||
    _.isNil(updatePartial)) {

    return;
  }

  return collections[collection].update(identityObject, {
    $set: updatePartial
  }).then(passParam, function(error) {
    console.error([
      colors.yellow.bgMagenta('achievibitDB.updatePartially'),
      ' got an error'
    ].join(''), error);
  });
}

function updatePartialArray(collection, identityObject, updatePartial) {
  if (_.isNil(collection) ||
    _.isNil(identityObject) ||
    _.isNil(updatePartial)) {

    return;
  }

  return collections[collection].update(identityObject, {
    $addToSet: updatePartial
  }).then(passParam, function(error) {
    console.error([
      colors.yellow.bgMagenta('achievibitDB.updatePartialArray'),
      ' got an error'
    ].join(''), error);
  });
}

function findItem(collection, identityObject) {
  if (_.isNil(collection) || _.isNil(identityObject)) {return;}
  return collections[collection].find(identityObject)
    .then(passParam, function(error) {
      console.error([
        colors.yellow.bgMagenta('achievibitDB.findItem'),
        ' got an error'
      ].join(''), error);
    }
  );
}

function addPRItems(pullRequest, givenCallback) {
  async.parallel([
    function insertOrganization(callback) {
      if (pullRequest.organization) {
        insertItem('users', pullRequest.organization).then(
            function() {
              callback(null, 'organization added');
            }, function(error) {
          console.error(error);
          callback(null, 'organization existed?');
        }
          );
      } else {
        callback(null, 'no organization to add');
      }
    }, function insertPRCreator(callback) {
      insertItem('users', pullRequest.creator)
        .then(function() {
          callback(null, 'PR creator added');
        }, function(error) {
          console.error(error);
          callback(null, 'PR creator existed?');
        });
    }, function insertReviewers(callback) {

      if (pullRequest.reviewers && pullRequest.reviewers.length > 0) {
        insertItem('users', pullRequest.reviewers)
          .then(function() {
            callback(null, 'reviewers added');
          }, function(error) {
            console.error(error);
            callback(null, 'reviewers existed?!');
          });
      } else {
        callback(null, 'no reviewers to add');
      }
    },
    function insertRepo(callback) {
      var repo = _.clone(pullRequest.repository);
      if (pullRequest.organization) {
        repo.organization = pullRequest.organization.username;
      }
      insertItem('repos', repo)
        .then(function() {
          callback(null, 'repo added');
        }, function() {
          callback(null, 'repo existed?');
        });
    }
  ], function(err, results) {
    console.info('PR items added to DB', {
      error: err,
      statuses: results
    });

    connectUsersAndRepos(pullRequest, givenCallback);
  });
}

function connectUsersAndRepos(pullRequest, givenCallback) {
  console.info('Connecting PR items');
  var repoDataForUsers = {
    repos: pullRequest.repository.fullname
  };

  var organizationDataForUsers;

  if (pullRequest.organization) {
    organizationDataForUsers = {
      organizations: pullRequest.organization.username
    };
  }

  var usersInPullRequest = _.map(pullRequest.reviewers, 'username')
    .concat([ pullRequest.creator.username ]);

  async.parallel([
    function addRepoToCreator(callback) {
      updatePartialArray('users', {
        username: pullRequest.creator.username
      }, repoDataForUsers).then(function() {
        callback(null, 'connected creator with repo');
      }, function(error) {
        callback(error, 'had a problem connecting creator with repo');
      });
    },
    function addOrganizationToCreator(callback) {
      if (organizationDataForUsers) {
        updatePartialArray('users', {
          username: pullRequest.creator.username
        }, organizationDataForUsers).then(function() {
          callback(null, 'connected creator to organization');
        }, function(error) {
          callback(error, 'had a problem connecting creator with organization');
        });
      } else {
        callback(null, 'no organization to connect to creator');
      }
    },
    function addRepoToReviewers(callback) {
      var allReviewersRequests = [];
      var allReviewersUsernames = _.map(pullRequest.reviewers, 'username');
      var createSingleUserRequest = function(username) {
        return function singleReviewerRepo(singleUserCallback) {
          updatePartialArray('users', {
            username: username
          }, repoDataForUsers).then(function() {
            singleUserCallback(null, [
              'connected reviewer ',
              username,
              ' with repo'
            ].join(''));
          }, function(error) {
            singleUserCallback(error, [
              'error connecting reviewer',
              username,
              ' to repo'
            ].join(''));
          });
        };
      };

      if (allReviewersUsernames && allReviewersUsernames.length > 0) {
        _.forEach(allReviewersUsernames, function(username) {
          allReviewersRequests.push(createSingleUserRequest(username));
        });

        async.parallel(allReviewersRequests, function(err, results) {
          callback(err, results);
        });
      } else {
        callback(null, 'no reviewers to connect to repo');
      }

    },
    function addOrganizationToReviewers(callback) {
      var allReviewersRequests = [];
      var allReviewersUsernames = _.map(pullRequest.reviewers, 'username');

      if (organizationDataForUsers && allReviewersRequests.length > 0) {

        var createSingleUserRequest = function(username) {
          return function singleReviewerOrganization(singleUserCallback) {
            updatePartialArray('users', {
              username: username
            }, organizationDataForUsers).then(function() {
              singleUserCallback(null, 'repo added to reviewer ' + username);
            }, function(error) {
              singleUserCallback(error, [
                'error connecting reviewer',
                username,
                ' to organization'
              ].join(''));
            });
          };
        };

        _.forEach(allReviewersUsernames, function(username) {
          allReviewersRequests.push(createSingleUserRequest(username));
        });

        async.parallel(allReviewersRequests, function(err, results) {
          callback(err, results);
        });
      } else {
        callback(null, allReviewersRequests.length === 0 ?
          'no reviewers to connect organization to' :
          'no organization to connect reviewers to'
        );
      }
    },
    function addUsersToOrganization(callback) {
      if (pullRequest.organization) {
        updatePartialArray('users', {
          username: pullRequest.organization.username
        }, {
          users: {
            $each: usersInPullRequest
          }
        }).then(function() {
          callback(null, 'PR users added to organization');
        }, function(error) {
          callback(error,
            'PR users had a problem connection with organization');
        });
      } else {
        callback(null, 'no organization to connect users to');
      }
    }
  ], function(err, results) {
    console.info('finished connecting users and repos to each other', {
      error: err,
      statuses: results
    });

    if (_.isFunction(givenCallback)) {
      givenCallback(err, results);
    }
  });
}

function getExtraPRData(pullRequest, givenCallback) {
  var ghpr = client.pr(pullRequest.repository.fullname, pullRequest.number);
  var ghissue =
    client.issue(pullRequest.repository.fullname, pullRequest.number);
  var ghrepo = client.repo(pullRequest.repository.fullname);

  async.parallel([
    getPRReactions(pullRequest),
    function fetchPRComments(callback) {
      ghissue.comments(function(err, comments) {
        if (err) {
          callback(err, 'had a problem adding comments');
          return;
        }

        pullRequest.comments = [];
        var reactionsRequests = [];

        _.forEach(comments, function(comment) {
          var commentParsed = utilities.parseComment(comment);
          pullRequest.comments.push(commentParsed);

          reactionsRequests.push(getReactions(commentParsed));
        });

        async.parallel(reactionsRequests, function(err) {
          if (err) {
            callback(err, 'had a problem getting reactions');
            return;
          }
          callback(null, 'comments & reactions fetched');
        });
      });
    },
    function fetchInlineComments(callback) {
      ghpr.comments(function(err, inlineComments) {
        if (err) {
          callback(err, 'had a problem getting inline comments');
          return;
        }

        pullRequest.inlineComments = [];
        var reactionsRequests = [];

        _.forEach(inlineComments, function(inlineComment) {
          var inlineCommentParsed =
            utilities.parseComment(inlineComment, true /* isInlineComment */);
          pullRequest.inlineComments.push(inlineCommentParsed);
          reactionsRequests.push(getReactions(inlineCommentParsed));
        });

        async.parallel(reactionsRequests, function(err) {
          if (err) {
            callback(err,
              'had a problem getting reactions for inline comments');
            return;
          }
          callback(null, 'inline comments & reactions fetched');
        });
      });
    },
    function fetchCommits(callback) {
      ghpr.commits(function(err, commits) {
        if (err) {
          callback(err, 'had a problem getting PR commits');
          return;
        }

        pullRequest.commits = [];
        _.forEach(commits, function(commit) {
          ghrepo.statuses(commit.sha, function(err, statuses) {
            pullRequest.commits.push({
              sha: commit.sha,
              author: utilities.parseUser(commit.author),
              committer: utilities.parseUser(commit.committer),
              message: commit.commit.message,
              commentCount: commit.comments,
              statuses: utilities.parseStatuses(statuses)
            });

            if (commits.indexOf(commit) === commits.length - 1) {
              callback(null, 'commits fetched');
            }
          });
        });
      });
    },
    function fetchPRFiles(callback) {
      ghpr.files(function(err, files) {
        if (err) {
          callback(err, 'had a problem getting PR files');
          return;
        }

        pullRequest.files = [];
        _.forEach(files, function(file) {
          pullRequest.files.push({
            content: getNewFileFromPatch(file.patch),
            name: file.filename
          });
        });

        callback(null, 'files fetched');
      });
    }
  ], function(err, results) {
    console.log('Got all extra PR data', {
      error: err,
      statuses: results
    });
    if (_.isFunction(givenCallback)) {
      givenCallback(err, results);
    }
  });
}

function getPRReactions(pullRequest) {
  return function requestPRReactions(callback) {
    var PRReactionsUrl = [
      apiUrl,
      pullRequest.repository.fullname,
      '/issues/',
      pullRequest.number,
      '/reactions'
    ].join('');
    request({
      url: PRReactionsUrl,
      headers: {
        'Accept': 'application/vnd.github.squirrel-girl-preview',
        'User-Agent': 'achievibit'
      }
    }, function(err, response, body) {
      if (err) {
        callback(err, 'had a problem getting reactions for PR');
        return;
      }

      if (response.statusCode === 200) {

        var reactions = JSON.parse(body);
        pullRequest.reactions = [];
        _.forEach(reactions, function(reaction) {
          pullRequest.reactions.push({
            reaction: reaction.content,
            user: utilities.parseUser(reaction.user)
          });
        });

        callback(null, 'PR reactions ready');
      } else {
        console.error([
          'wrong status from server: ',
          '[', response.statusCode, ']'
        ].join(''), body);
        callback(PRReactionsUrl, 'reactions had a problem');
      }
    });
  };
}

function getReactions(comment) {
  return function getSpecificCommentReactions(callback) {
    request({
      url: comment.apiUrl + '/reactions',
      headers: {
        'Accept': 'application/vnd.github.squirrel-girl-preview',
        'User-Agent': 'achievibit'
      }
    }, function(err, response, body) {
      if (err) {
        callback(err, 'had a problem getting reaction');
        return;
      }

      if (response.statusCode === 200) {

        var reactions = JSON.parse(body);
        comment.reactions = [];
        _.forEach(reactions, function(reaction) {
          comment.reactions.push({
            reaction: reaction.content,
            user: utilities.parseUser(reaction.user)
          });
        });

        callback(null, 'reactions ready');
      } else {
        console.error([
          'wrong status from server: ',
          '[', response.statusCode, ']'
        ].join(''), body);
        callback(comment.apiUrl, 'reactions had a problem');
      }
    });
  };
}

function createAchievibitWebhook(repoName, gToken, uid) {
  var githubWebhookConfig = {
    name: 'web', //'achievibit',
    active: true,
    events: [
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment'
    ],
    config: {
      'url': 'http://achievibit.kibibit.io/',
      'content_type': 'json'
    }
  };

  var creatWebhookUrl = [
    apiUrl,
    repoName,
    '/hooks'
  ].join('');
  request({
    method: 'POST',
    url: creatWebhookUrl,
    headers: {
      'User-Agent': 'achievibit',
      'Authorization': 'token ' + gToken
    },
    json: true,
    body: githubWebhookConfig
  }, function(err, response, body) {
    if (err) {
      console.error('had a problem creating a webhook for ' + repoName, err);
      return;
    }

    if (response.statusCode === 200 || response.statusCode === 201) {
      console.log('webhook added successfully');
      var identityObject = {
        uid: uid
      };
      findItem('userSettings', identityObject).then(function(savedUser) {
        if (!_.isEmpty(savedUser)) {
          savedUser = savedUser[0];
          var newIntegrations =
            _.map(savedUser.reposIntegration, function(repo) {
              if (repo.name === repoName) {
                repo.id = body.id;
                repo.integrated = true;
              }

              return repo;
            });
          updatePartially('userSettings', identityObject, {
            'reposIntegration': newIntegrations
          });
        }
      });
    } else {
      console.error([
        'creating webhook: ',
        'wrong status from server: ',
        '[', response.statusCode, ']'
      ].join(''), body);
    }
  });
}

function deleteAchievibitWebhook(repoName, gToken, uid) {
  var deleteWebhookUrl = [
    apiUrl,
    repoName,
    '/hooks'
  ].join('');

  var identityObject = {
    uid: uid
  };

  findItem('userSettings', identityObject).then(function(savedUser) {
    if (!_.isEmpty(savedUser)) {
      savedUser = savedUser[0];
      var repoUserData = _.find(savedUser.reposIntegration, {
        name: repoName
      });

      if (!repoUserData.id) {
        return 'error!';
      }
      deleteWebhookUrl += '/' + repoUserData.id;
      repoUserData.id = null;
      repoUserData.integrated = false;

      request({
        method: 'DELETE',
        url: deleteWebhookUrl,
        headers: {
          'User-Agent': 'achievibit',
          'Authorization': 'token ' + gToken
        },
        json: true
      }, function(err, response, body) {
        if (err) {
          console.error('had a problem deleting a webhook for ' + repoName,
            err);
          return;
        }

        updatePartially('userSettings', identityObject, {
          'reposIntegration': savedUser.reposIntegration
        });
      });
    } else {
      return 'error!';
    }
  });
}

function getAndUpdateUserData(uid, updateWith) {
  var deferred = Q.defer();
  if (_.isNil(uid)) { deferred.reject('expected a uid'); }

  // var authUsers = collections.userSettings;
  var identityObject = {
    uid: uid
  };

  findItem('userSettings', identityObject).then(function(savedUser) {
    if (!_.isEmpty(savedUser)) {
      savedUser = savedUser[0];
      if (!_.isEmpty(updateWith)) { // new sign in so update tokens
        updatePartially('userSettings', identityObject, updateWith);
      }
      // we don't wait for the promise here because we already have the new data
      // update if needed
      savedUser.username = updateWith.username || savedUser.username;
      savedUser.githubToken = updateWith.githubToken || savedUser.githubToken;
      // return the updated saved user
      deferred.resolve(savedUser);
    } else { // this is a new user in our database
      // we should have this data given from the client if it's a new user,
      // but something can go wrong sometimes, so: defaults.
      var newUser = {
        username: updateWith.username || null,
        uid: uid,
        signedUpOn: Date.now(),
        postAchievementsAsComments:
          updateWith.postAchievementsAsComments || true,
        reposIntegration: updateWith.reposIntegration || [],
        timezone: updateWith.timezone || null,
        githubToken: updateWith.githubToken || null
      };

      // get the user's repos and store them in the user object
      var client = github.client(newUser.githubToken);
      var ghme = client.me();

      ghme.repos(function(err, repos) { // headers
        if (err) resolve.reject('couldn\'t fetch repos');
        else {
          var parsedRepos = [];
          _.forEach(repos, function(repo) {
            //var escapedRepoName = _.replace(repo.full_name, /\./g, '@@@');
            parsedRepos.push({
              name: repo.full_name,
              integrated: false
            });
          });
          newUser.reposIntegration = parsedRepos;

          // test out automatic integration with Thatkookooguy/monkey-js
          // createAchievibitWebhook(_.find(repos, {
          //   'full_name': 'Thatkookooguy/monkey-js'
          // }), newUser.githubToken);

          insertItem('userSettings', newUser);
          // this is added to the db. create a copy of new user first
          var returnedUser = _.clone(newUser);
          returnedUser.newUser = true;

          deferred.resolve(returnedUser);
        }
      });
    }
  }, function(error) {
    deferred.reject('something went wrong with searching a user', error);
  });

  return deferred.promise;
}

function getNewFileFromPatch(patch) {
  if (!patch) {
    return;
  }
  return patch.split('\n').filter(function(line) {
    return !line.startsWith('-') &&
      !line.startsWith('@') &&
      line.indexOf('No newline at end of file') === -1;
  }).map(function(line) {
    if (line.startsWith('+')) {
      return line.replace('+', '');
    }

    return line;
  }).join('\n');
}

function passParam(param) {
  return param;
}
