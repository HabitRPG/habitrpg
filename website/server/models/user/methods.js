import common from '../../../common';
import Bluebird from 'bluebird';
import {
  chatDefaults,
  TAVERN_ID,
} from '../group';
import { defaults } from 'lodash';
import { model as UserNotification } from '../userNotification';
import schema from './schema';

schema.methods.isSubscribed = function isSubscribed () {
  return !!this.purchased.plan.customerId; // eslint-disable-line no-implicit-coercion
};

// Get an array of groups ids the user is member of
schema.methods.getGroups = function getUserGroups () {
  let userGroups = this.guilds.slice(0); // clone user.guilds so we don't modify the original
  if (this.party._id) userGroups.push(this.party._id);
  userGroups.push(TAVERN_ID);
  return userGroups;
};

schema.methods.sendMessage = async function sendMessage (userToReceiveMessage, message) {
  let sender = this;

  common.refPush(userToReceiveMessage.inbox.messages, chatDefaults(message, sender));
  userToReceiveMessage.inbox.newMessages++;
  userToReceiveMessage._v++;
  userToReceiveMessage.markModified('inbox.messages');

  common.refPush(sender.inbox.messages, defaults({sent: true}, chatDefaults(message, userToReceiveMessage)));
  sender.markModified('inbox.messages');

  let promises = [userToReceiveMessage.save(), sender.save()];
  await Bluebird.all(promises);
};

/**
 * Creates a notification and based on the input parameters and adds it to the local user notifications array.
 * This does not save the notification to the database or interact with the database in any way.
 *
 * @param  type  The type of notification to add to the user. Possible values are defined in the UserNotificaiton Schema
 * @param  data  The data to add to the notification
 */
schema.methods.addNotification = function addUserNotification (type, data = {}) {
  this.notifications.push({
    type,
    data,
  });
};

/**
 * Creates a notification based on the type and data input parameters and saves that new notification
 * to the database directly using an update statement. The local copy of these users are not updated by
 * this operation.
 *
 * @param  userIds An array containing the ids of the users to add this notification to
 * @param  type  The type of notification to add to the user. Possible values are defined in the UserNotificaiton Schema
 * @param  data  The data to add to the notification
 */
schema.statics.addUserNotificationUpdate = async function addUserNotificationUpdate (userIds, type, data = {}) {
  let newNotification = new UserNotification({type, data});
  let promises = [];
  userIds.forEach(userId => {
    promises.push(this.update({_id: userId}, {$push: {notifications: newNotification}}).exec());
  });
  await Bluebird.all(promises);
};

// Add stats.toNextLevel, stats.maxMP and stats.maxHealth
// to a JSONified User stats object
schema.methods.addComputedStatsToJSONObj = function addComputedStatsToUserJSONObj (statsObject) {
  // NOTE: if an item is manually added to user.stats then
  // common/fns/predictableRandom must be tweaked so the new item is not considered.
  // Otherwise the client will have it while the server won't and the results will be different.
  statsObject.toNextLevel = common.tnl(this.stats.lvl);
  statsObject.maxHealth = common.maxHealth;
  statsObject.maxMP = common.statsComputed(this).maxMP;

  return statsObject;
};
