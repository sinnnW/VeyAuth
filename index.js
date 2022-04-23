const path = require('path')

module.exports = {
  Core: require(path.join(__dirname, 'dist/index.js')).Core,
  App: require(path.join(__dirname, 'dist/types/App.js')).App,
  User: require(path.join(__dirname, 'dist/types/User.js')).User,
  Variable: require(path.join(__dirname, 'dist/types/Variable.js')).Variable,
  Subscription: require(path.join(__dirname, 'dist/types/Subscription.js')).Subscription,
  SubscriptionLevel: require(path.join(__dirname, 'dist/types/SubscriptionLevel.js')).SubscriptionLevel,
  File: require(path.join(__dirname, 'dist/types/File.js')).File,
  Invite: require(path.join(__dirname, 'dist/types/Invite.js')).Invite
}