import moment from 'moment';
import mongoose from 'mongoose';
import _ from 'lodash';
import validator from 'validator';
import nconf from 'nconf';
import { // eslint-disable-line import/no-cycle
  model as User,
  nameFields,
} from './user';
import shared from '../../common';
import { model as Challenge } from './challenge'; // eslint-disable-line import/no-cycle
import {
  chatModel as Chat,
  setUserStyles,
  messageDefaults,
} from './message';
import * as Tasks from './task';
import { removeFromArray } from '../libs/collectionManipulators';
import payments from '../libs/payments/payments'; // eslint-disable-line import/no-cycle
import { // eslint-disable-line import/no-cycle
  groupChatReceivedWebhook,
  questActivityWebhook,
} from '../libs/webhook';
import {
  InternalServerError,
  BadRequest,
  NotAuthorized,
} from '../libs/errors';
import baseModel from '../libs/baseModel';
import { sendTxn as sendTxnEmail } from '../libs/email'; // eslint-disable-line import/no-cycle
import { sendNotification as sendPushNotification } from '../libs/pushNotifications'; // eslint-disable-line import/no-cycle
import { // eslint-disable-line import/no-cycle
  syncableAttrs,
} from '../libs/tasks/utils';
import {
  schema as SubscriptionPlanSchema,
} from './subscriptionPlan';
import logger from '../libs/logger';
import amazonPayments from '../libs/payments/amazon'; // eslint-disable-line import/no-cycle
import stripePayments from '../libs/payments/stripe'; // eslint-disable-line import/no-cycle
import { getGroupChat, translateMessage } from '../libs/chat/group-chat'; // eslint-disable-line import/no-cycle
import { model as UserNotification } from './userNotification';
import { sendChatPushNotifications } from '../libs/chat'; // eslint-disable-line import/no-cycle

const questScrolls = shared.content.quests;
const { questSeriesAchievements } = shared.content;
const { Schema } = mongoose;

export const INVITES_LIMIT = 100; // must not be greater than MAX_EMAIL_INVITES_BY_USER
export const { TAVERN_ID } = shared;

const NO_CHAT_NOTIFICATIONS = [TAVERN_ID];
const { LARGE_GROUP_COUNT_MESSAGE_CUTOFF } = shared.constants;
const { MAX_SUMMARY_SIZE_FOR_GUILDS } = shared.constants;
const { GUILDS_PER_PAGE } = shared.constants;

const { CHAT_FLAG_LIMIT_FOR_HIDING } = shared.constants;

const CRON_SAFE_MODE = nconf.get('CRON_SAFE_MODE') === 'true';
const CRON_SEMI_SAFE_MODE = nconf.get('CRON_SEMI_SAFE_MODE') === 'true';
const MAX_UPDATE_RETRIES = 5;

/*
#  Spam constants to limit people from sending too many messages too quickly
#    SPAM_MESSAGE_LIMIT - The amount of messages that can be sent in a time window
#    SPAM_WINDOW_LENGTH - The window length for spam protection in milliseconds
#    SPAM_MIN_EXEMPT_CONTRIB_LEVEL - Anyone at or above this level is exempt
*/
export const SPAM_MESSAGE_LIMIT = 2;
export const SPAM_WINDOW_LENGTH = 60000; // 1 minute
export const SPAM_MIN_EXEMPT_CONTRIB_LEVEL = 4;

export const MAX_CHAT_COUNT = 200;
export const MAX_SUBBED_GROUP_CHAT_COUNT = 400;

export const schema = new Schema({
  name: { $type: String, required: true },
  summary: { $type: String, maxlength: MAX_SUMMARY_SIZE_FOR_GUILDS },
  description: String,
  leader: {
    $type: String, ref: 'User', validate: [v => validator.isUUID(v), 'Invalid uuid for group leader.'], required: true,
  },
  type: { $type: String, enum: ['guild', 'party'], required: true },
  privacy: {
    $type: String, enum: ['private', 'public'], default: 'private', required: true,
  },
  chat: Array, // Used for backward compatibility, but messages aren't stored here
  bannedWordsAllowed: { $type: Boolean, required: false },
  leaderOnly: { // restrict group actions to leader (members can't do them)
    challenges: { $type: Boolean, default: false, required: true },
    // invites: {$type: Boolean, default: false, required: true},
    // Some group plans prevent members from getting gems
    getGems: { $type: Boolean, default: false },
  },
  memberCount: { $type: Number, default: 1 },
  challengeCount: { $type: Number, default: 0 },
  balance: { $type: Number, default: 0 },
  logo: String,
  leaderMessage: String,
  quest: {
    key: String,
    active: { $type: Boolean, default: false },
    leader: { $type: String, ref: 'User' },
    progress: {
      hp: Number,
      collect: {
        $type: Schema.Types.Mixed,
        default: () => ({}),
      }, // {feather: 5, ingot: 3}
      rage: Number, // limit break / "energy stored in shell", for explosion-attacks
    },

    // Shows boolean for each party-member who has accepted the quest.
    // Eg {UUID: true, UUID: false}. Once all users click
    // 'Accept', the quest begins.
    // If a false user waits too long, probably a good sign to prod them or boot them.
    // TODO when booting user, remove from .joined and check again if we can now start the quest
    members: {
      $type: Schema.Types.Mixed,
      default: () => ({}),
    },
    extra: {
      $type: Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  tasksOrder: {
    habits: [{ $type: String, ref: 'Task' }],
    dailys: [{ $type: String, ref: 'Task' }],
    todos: [{ $type: String, ref: 'Task' }],
    rewards: [{ $type: String, ref: 'Task' }],
  },
  purchased: {
    plan: {
      $type: SubscriptionPlanSchema,
      default: () => ({}),
    },
  },
  managers: {
    $type: Schema.Types.Mixed,
    default: () => ({}),
  },
  categories: [{
    slug: { $type: String },
    name: { $type: String },
  }],
}, {
  strict: true,
  minimize: false, // So empty objects are returned
  typeKey: '$type', // So that we can use fields named `type`
});

schema.plugin(baseModel, {
  noSet: ['_id', 'balance', 'quest', 'memberCount', 'chat', 'bannedWordsAllowed', 'challengeCount', 'tasksOrder', 'purchased', 'managers'],
  private: ['purchased.plan'],
  toJSONTransform (plainObj, originalDoc) {
    if (plainObj.purchased) plainObj.purchased.active = originalDoc.hasActiveGroupPlan();
  },
});

schema.pre('init', group => {
  // The Vue website makes the summary be mandatory for all new groups, but the
  // Angular website did not, and the API does not yet for backwards-compatibility.
  // When any guild without a summary is fetched from the database, this code
  // supplies the name as the summary. This can be removed when all guilds have
  // a summary and the API makes it mandatory (a breaking change!)
  // NOTE: the Tavern and parties do NOT need summaries so ensure they don't break
  // if we remove this code.
  if (!group.summary) {
    group.summary = group.name ? group.name.substring(0, MAX_SUMMARY_SIZE_FOR_GUILDS) : ' ';
  }
});

// A list of additional fields that cannot be updated (but can be set on creation)
const noUpdate = ['privacy', 'type'];
schema.statics.sanitizeUpdate = function sanitizeUpdate (updateObj) {
  return this.sanitize(updateObj, noUpdate);
};

// Basic fields to fetch for populating a group info
export const basicFields = 'name type privacy leader summary categories';

schema.pre('remove', true, async function preRemoveGroup (next, done) {
  next();
  try {
    await this.removeGroupInvitations();
    done();
  } catch (err) {
    done(err);
  }
});

// return clean updates for each user in a party without resetting their progress
function _cleanQuestParty (merge) {
  const updates = {
    $set: {
      'party.quest.key': null,
      'party.quest.completed': null,
      'party.quest.RSVPNeeded': false,
    },
  };

  if (merge) _.merge(updates, merge);

  return updates;
}

// return a clean user.quest of a particular user while keeping his progress
function _cleanQuestUser (userProgress) {
  if (!userProgress) {
    userProgress = { // eslint-disable-line no-param-reassign
      up: 0,
      down: 0,
      collect: {},
      collectedItems: 0,
    };
  } else {
    userProgress = userProgress.toObject(); // eslint-disable-line no-param-reassign
  }

  const clean = {
    key: null,
    progress: userProgress,
    completed: null,
    RSVPNeeded: false,
  };

  return clean;
}

schema.statics.getGroup = async function getGroup (options = {}) {
  const {
    user, groupId, fields, optionalMembership = false,
    populateLeader = false, requireMembership = false,
  } = options;
  let query;

  const isUserParty = groupId === 'party' || user.party._id === groupId;
  const isUserGuild = user.guilds.indexOf(groupId) !== -1;
  const isTavern = ['habitrpg', TAVERN_ID].indexOf(groupId) !== -1;

  // When requireMembership is true check that user is member even in public guild
  if (requireMembership && !isUserParty && !isUserGuild && !isTavern) {
    return null;
  }

  // When optionalMembership is true it's not required for the user to be a member of the group
  if (isUserParty) {
    query = { type: 'party', _id: user.party._id };
  } else if (isTavern) {
    query = { _id: TAVERN_ID };
  } else if (optionalMembership === true) {
    query = { _id: groupId };
  } else if (isUserGuild) {
    query = { type: 'guild', _id: groupId };
  } else {
    query = { type: 'guild', privacy: 'public', _id: groupId };
  }

  const mQuery = this.findOne(query);
  if (fields) mQuery.select(fields);
  if (populateLeader === true) mQuery.populate('leader', nameFields);
  const group = await mQuery.exec();

  if (!group) {
    if (groupId === user.party._id) {
      // reset party object to default state
      user.party = {};
    } else {
      removeFromArray(user.guilds, groupId);
    }
    await user.save();
  }

  return group;
};

export const VALID_QUERY_TYPES = ['party', 'guilds', 'privateGuilds', 'publicGuilds', 'tavern'];

schema.statics.getGroups = async function getGroups (options = {}) {
  const {
    user, types, groupFields = basicFields,
    sort = '-memberCount', populateLeader = false,
    paginate = false, page = 0, // optional pagination for public guilds
    filters = {},
  } = options;
  const queries = [];

  // Throw error if an invalid type is supplied
  const areValidTypes = types.every(type => VALID_QUERY_TYPES.indexOf(type) !== -1);
  if (!areValidTypes) throw new BadRequest(shared.i18n.t('groupTypesRequired'));

  types.forEach(type => {
    switch (type) { // eslint-disable-line default-case
      case 'party': {
        queries.push(this.getGroup({
          user, groupId: 'party', fields: groupFields, populateLeader,
        }));
        break;
      }
      case 'guilds': {
        const query = {
          type: 'guild',
          _id: { $in: user.guilds, $ne: TAVERN_ID },
        };
        _.assign(query, filters);
        const userGuildsQuery = this.find(query).select(groupFields);
        if (populateLeader === true) userGuildsQuery.populate('leader', nameFields);
        userGuildsQuery.sort(sort).exec();
        queries.push(userGuildsQuery);
        break;
      }
      case 'privateGuilds': {
        const query = {
          type: 'guild',
          privacy: 'private',
          _id: { $in: user.guilds },
        };
        _.assign(query, filters);
        const privateGuildsQuery = this.find(query).select(groupFields);
        if (populateLeader === true) privateGuildsQuery.populate('leader', nameFields);
        privateGuildsQuery.sort(sort).exec();
        queries.push(privateGuildsQuery);
        break;
      }
      // NOTE: when returning publicGuilds we use `.lean()` so all
      // mongoose methods won't be available.
      // Docs are going to be plain javascript objects
      case 'publicGuilds': {
        const query = {
          type: 'guild',
          privacy: 'public',
          _id: { $ne: TAVERN_ID },
        };
        _.assign(query, filters);

        const publicGuildsQuery = this.find(query).select(groupFields);

        if (populateLeader === true) publicGuildsQuery.populate('leader', nameFields);
        if (paginate === true) {
          publicGuildsQuery.limit(GUILDS_PER_PAGE).skip(page * GUILDS_PER_PAGE);
        }
        publicGuildsQuery.sort(sort).lean().exec();
        queries.push(publicGuildsQuery);

        break;
      }
      case 'tavern': {
        if (types.indexOf('publicGuilds') === -1) {
          queries.push(this.getGroup({ user, groupId: TAVERN_ID, fields: groupFields }));
        }
        break;
      }
    }
  });

  const groupsArray = _.reduce(await Promise.all(queries), (previousValue, currentValue) => {
    // don't add anything to the results if the query returned null or an empty array
    if (_.isEmpty(currentValue)) return previousValue;
    // otherwise concat the new results to the previousValue
    return previousValue.concat(Array.isArray(currentValue) ? currentValue : [currentValue]);
  }, []);

  return groupsArray;
};

// When converting to json remove chat messages with more than 1 flag and remove all flags info
// unless the user is an admin or said chat is posted by that user
// Not putting into toJSON because there we can't access user
// It also removes the _meta field that can be stored inside a chat message
schema.statics.toJSONCleanChat = async function groupToJSONCleanChat (group, user) {
  // @TODO: Adding this here for support the old chat,
  // but we should depreciate accessing chat like this
  // Also only return chat if requested, eventually we don't want to return chat here
  if (group && group.chat) {
    await getGroupChat(group);
  }

  const groupToJson = group.toJSON();
  const userLang = user.preferences.language;

  groupToJson.chat = groupToJson.chat
    .map(chatMsg => {
      // Translate system messages
      if (!_.isEmpty(chatMsg.info)) {
        chatMsg.text = translateMessage(userLang, chatMsg.info);
      }

      // Convert to timestamps because Android expects it
      // old chats are saved with a numeric timestamp
      // new chats use `Date` which then has to be converted to the numeric timestamp
      if (chatMsg.timestamp && chatMsg.timestamp.getTime) {
        chatMsg.timestamp = chatMsg.timestamp.getTime();
      }

      if (!user.contributor.admin) {
        // Flags are hidden to non admins
        chatMsg.flags = {};
        if (chatMsg._meta) chatMsg._meta = undefined;

        // Messages with too many flags are hidden to non-admins and non-authors
        if (user._id !== chatMsg.uuid && chatMsg.flagCount >= CHAT_FLAG_LIMIT_FOR_HIDING) {
          return undefined;
        }
      }

      return chatMsg;
    })
    // Used to filter for undefined chat messages that should not be shown to non-admins
    .filter(chatMsg => chatMsg !== undefined);

  return groupToJson;
};

function getInviteError (uuids, emails, usernames) {
  const uuidsIsArray = Array.isArray(uuids);
  const emailsIsArray = Array.isArray(emails);
  const usernamesIsArray = Array.isArray(usernames);
  const emptyEmails = emailsIsArray && emails.length < 1;
  const emptyUuids = uuidsIsArray && uuids.length < 1;
  const emptyUsernames = usernamesIsArray && usernames.length < 1;

  let errorString;

  if (!uuids && !emails && !usernames) {
    errorString = 'canOnlyInviteEmailUuid';
  } else if (uuids && !uuidsIsArray) {
    errorString = 'uuidsMustBeAnArray';
  } else if (emails && !emailsIsArray) {
    errorString = 'emailsMustBeAnArray';
  } else if (usernames && !usernamesIsArray) {
    errorString = 'usernamesMustBeAnArray';
  } else if ((!emails || emptyEmails) && (!uuids || emptyUuids) && (!usernames || emptyUsernames)) {
    errorString = 'inviteMustNotBeEmpty';
  }

  return errorString;
}

function getInviteCount (uuids, emails) {
  let totalInvites = 0;

  if (uuids) {
    totalInvites += uuids.length;
  }

  if (emails) {
    totalInvites += emails.length;
  }

  return totalInvites;
}

/**
 * Checks invitation uuids and emails for possible errors.
 *
 * @param  uuids  An array of User IDs
 * @param  emails  An array of emails
 * @param  res  Express res object for use with translations
 * @throws BadRequest An error describing the issue with the invitations
 */
schema.statics.validateInvitations = async function getInvitationErr (invites, res, group = null) {
  const {
    uuids,
    emails,
    usernames,
  } = invites;
  const errorString = getInviteError(uuids, emails, usernames);
  if (errorString) throw new BadRequest(res.t(errorString));

  const totalInvites = getInviteCount(uuids, emails);
  if (totalInvites > INVITES_LIMIT) {
    throw new BadRequest(res.t('canOnlyInviteMaxInvites', { maxInvites: INVITES_LIMIT }));
  }

  // If party, check the limit of members
  if (group && group.type === 'party') {
    let memberCount = 0;

    // Counting the members that already joined the party
    memberCount += group.memberCount;

    // Count how many invitations currently exist in the party
    const query = {};
    query['invitations.party.id'] = group._id;
    // @TODO invitations are now stored like this: `'invitations.parties': []`
    const groupInvites = await User.countDocuments(query).exec();
    memberCount += groupInvites;

    // Counting the members that are going to be invited by email and uuids
    memberCount += totalInvites;

    if (memberCount > shared.constants.PARTY_LIMIT_MEMBERS) {
      throw new BadRequest(res.t('partyExceedsMembersLimit', { maxMembersParty: shared.constants.PARTY_LIMIT_MEMBERS }));
    }
  }
};

schema.methods.getParticipatingQuestMembers = function getParticipatingQuestMembers () {
  return Object.keys(this.quest.members).filter(member => this.quest.members[member]);
};

schema.methods.removeGroupInvitations = async function removeGroupInvitations () {
  const group = this;

  const usersToRemoveInvitationsFrom = await User.find({
    [`invitations.${group.type}${group.type === 'guild' ? 's' : ''}.id`]: group._id,
  }).exec();

  const userUpdates = usersToRemoveInvitationsFrom.map(user => {
    if (group.type === 'party') {
      removeFromArray(user.invitations.parties, { id: group._id });
      user.invitations.party = user.invitations.parties.length > 0
        ? user.invitations.parties[user.invitations.parties.length - 1] : {};
      this.markModified('invitations.party');
    } else {
      removeFromArray(user.invitations.guilds, { id: group._id });
    }
    return user.save();
  });

  return Promise.all(userUpdates);
};

// Return true if user is a member of the group
schema.methods.isMember = function isGroupMember (user) {
  if (this._id === TAVERN_ID) {
    return true; // everyone is considered part of the tavern
  } if (this.type === 'party') {
    return user.party._id === this._id;
  } // guilds
  return user.guilds.indexOf(this._id) !== -1;
};

schema.methods.getMemberCount = async function getMemberCount () {
  let query = { guilds: this._id };

  if (this.type === 'party') {
    query = { 'party._id': this._id };
  }

  return User.countDocuments(query).exec();
};

schema.methods.sendChat = function sendChat (options = {}) {
  const {
    message, user, metaData,
    client, flagCount = 0, info = {},
    translate, mentions, mentionedMembers,
  } = options;
  const newMessage = messageDefaults(message, user, client, flagCount, info);

  let newChatMessage = new Chat();
  newChatMessage = Object.assign(newChatMessage, newMessage);
  newChatMessage.groupId = this._id;

  if (user) setUserStyles(newChatMessage, user);

  // Optional data stored in the chat message but not returned
  // to the users that can be stored for debugging purposes
  if (metaData) {
    newChatMessage._meta = metaData;
  }

  // Activate the webhook for receiving group chat messages before
  // newChatMessage is possibly returned
  this.sendGroupChatReceivedWebhooks(newChatMessage);

  // do not send notifications for:
  // - groups that never send notifications (e.g., Tavern)
  // - groups with very many users
  // - messages that have already been flagged to hide them
  if (
    NO_CHAT_NOTIFICATIONS.indexOf(this._id) !== -1
    || this.memberCount > LARGE_GROUP_COUNT_MESSAGE_CUTOFF
    || newChatMessage.flagCount >= CHAT_FLAG_LIMIT_FOR_HIDING
  ) {
    return newChatMessage;
  }

  // Kick off chat notifications in the background.

  const query = {};

  if (this.type === 'party') {
    query['party._id'] = this._id;
  } else {
    query.guilds = this._id;
  }

  query._id = { $ne: user ? user._id : '' };

  // First remove the old notification (if it exists)
  const lastSeenUpdateRemoveOld = {
    $pull: {
      notifications: { type: 'NEW_CHAT_MESSAGE', 'data.group.id': this._id },
    },
  };

  // Then add the new notification
  const lastSeenUpdateAddNew = {
    $set: { // old notification, supported until mobile is updated and we release api v4
      [`newMessages.${this._id}`]: { name: this.name, value: true },
    },
    $push: {
      notifications: new UserNotification({
        type: 'NEW_CHAT_MESSAGE',
        data: { group: { id: this._id, name: this.name } },
      }).toObject(),
    },
  };

  User
    .update(query, lastSeenUpdateRemoveOld, { multi: true })
    .exec()
    .then(() => User.update(query, lastSeenUpdateAddNew, { multi: true }).exec())
    .catch(err => logger.error(err));

  if (this.type === 'party' && user) {
    sendChatPushNotifications(user, this, newChatMessage, mentions, translate);
  }
  if (mentionedMembers) {
    mentionedMembers.forEach(member => {
      if (member._id === user._id) return;
      const pushNotifPrefs = member.preferences.pushNotifications;
      if (this.type === 'party') {
        if (pushNotifPrefs.mentionParty !== true || !this.isMember(member)) {
          return;
        }
      } else if (this.isMember(member)) {
        if (pushNotifPrefs.mentionJoinedGuild !== true) {
          return;
        }
      } else {
        if (this.privacy !== 'public') {
          return;
        }
        if (pushNotifPrefs.mentionUnjoinedGuild !== true) {
          return;
        }
      }

      if (newChatMessage.unformattedText) {
        sendPushNotification(member, {
          identifier: 'chatMention',
          title: `${user.profile.name} mentioned you in ${this.name}`,
          message: newChatMessage.unformattedText,
          payload: { type: this.type },
        });
      }
    });
  }
  return newChatMessage;
};

schema.methods.handleQuestInvitation = async function handleQuestInvitation (user, accept) {
  if (!user) throw new InternalServerError('Must provide user to handle quest invitation');
  if (accept !== true && accept !== false) throw new InternalServerError('Must provide accept param handle quest invitation');

  // Handle quest invitation atomically (update only current member when still undecided)
  // to prevent multiple concurrent requests overriding updates
  // see https://github.com/HabitRPG/habitica/issues/11398
  const Group = this.constructor;
  const result = await Group.update(
    {
      _id: this._id,
      [`quest.members.${user._id}`]: { $type: 10 }, // match BSON Type Null (type number 10)
    },
    { $set: { [`quest.members.${user._id}`]: accept } },
  ).exec();

  if (result.nModified) {
    // update also current instance so future operations will work correctly
    this.quest.members[user._id] = accept;
  }

  return Boolean(result.nModified);
};

schema.methods.startQuest = async function startQuest (user) {
  // not using i18n strings because these errors are meant
  // for devs who forgot to pass some parameters
  if (this.type !== 'party') throw new InternalServerError('Must be a party to use this method');
  if (!this.quest.key) throw new InternalServerError('Party does not have a pending quest');
  if (this.quest.active) throw new InternalServerError('Quest is already active');

  const userIsParticipating = this.quest.members[user._id];
  const quest = questScrolls[this.quest.key];
  let collected = {};
  if (quest.collect) {
    collected = _.transform(quest.collect, (result, n, itemToCollect) => {
      result[itemToCollect] = 0;
    });
  }

  this.markModified('quest');
  this.quest.active = true;
  if (quest.boss) {
    this.quest.progress.hp = quest.boss.hp;
    if (quest.boss.rage) this.quest.progress.rage = 0;
  } else if (quest.collect) {
    this.quest.progress.collect = collected;
  }

  const nonMembers = Object.keys(_.pickBy(this.quest.members, member => !member));

  // Changes quest.members to only include participating members
  this.quest.members = _.pickBy(this.quest.members, _.identity);

  // Persist quest.members early to avoid simultaneous handling of accept/reject
  // while processing the rest of this script
  await this.update({ $set: { 'quest.members': this.quest.members } }).exec();

  const nonUserQuestMembers = _.keys(this.quest.members);
  removeFromArray(nonUserQuestMembers, user._id);

  // remove any users from quest.members who aren't in the party
  // and get the data necessary to send webhooks
  const members = [];

  await User.find({
    _id: { $in: Object.keys(this.quest.members) },
  })
    .select('party.quest party._id items.quests auth preferences.emailNotifications preferences.pushNotifications preferences.language pushDevices profile.name webhooks')
    .lean()
    .exec()
    .then(partyMembers => {
      partyMembers.forEach(member => {
        if (!member.party || member.party._id !== this._id) {
          delete this.quest.members[member._id];
        } else {
          members.push(member);
        }
      });
    });

  if (userIsParticipating) {
    user.party.quest.key = this.quest.key;
    user.party.quest.progress.down = 0;
    user.party.quest.completed = null;
    user.markModified('party.quest');
  }

  const promises = [];

  // Remove the quest from the quest leader items (if they are the current user)
  if (this.quest.leader === user._id) {
    user.items.quests[this.quest.key] -= 1;
    user.markModified('items.quests');
    promises.push(user.save());
  } else { // another user is starting the quest, update the leader separately
    promises.push(User.update({ _id: this.quest.leader }, {
      $inc: {
        [`items.quests.${this.quest.key}`]: -1,
      },
    }).exec());
  }

  // update the remaining users
  promises.push(User.update({
    _id: { $in: nonUserQuestMembers },
  }, {
    $set: {
      'party.quest.key': this.quest.key,
      'party.quest.progress.down': 0,
      'party.quest.completed': null,
    },
  }, { multi: true }).exec());

  await Promise.all(promises);

  // update the users who are not participating
  // Do not block updates
  User.update({
    _id: { $in: nonMembers },
  }, _cleanQuestParty(),
  { multi: true }).exec();

  const newMessage = this.sendChat({
    message: `\`${shared.i18n.t('chatQuestStarted', { questName: quest.text('en') }, 'en')}\``,
    metaData: {
      participatingMembers: this.getParticipatingQuestMembers().join(', '),
    },
    info: {
      type: 'quest_start',
      quest: quest.key,
    },
  });
  await newMessage.save();

  const membersToEmail = [];

  // send notifications and webhooks in the background without blocking
  members.forEach(member => {
    if (member._id !== user._id) {
      // send push notifications and filter users that disabled emails
      if (member.preferences.emailNotifications.questStarted !== false) {
        membersToEmail.push(member);
      }

      // send push notifications and filter users that disabled emails
      if (member.preferences.pushNotifications.questStarted !== false) {
        const memberLang = member.preferences.language;
        sendPushNotification(member, {
          title: quest.text(memberLang),
          message: shared.i18n.t('questStarted', memberLang),
          identifier: 'questStarted',
        });
      }
    }

    // Send webhooks
    questActivityWebhook.send(member, {
      type: 'questStarted',
      group: this,
      quest,
    });
  });

  // Send emails in bulk
  sendTxnEmail(membersToEmail, 'quest-started', [
    { name: 'PARTY_URL', content: '/party' },
  ]);
};

schema.methods.sendGroupChatReceivedWebhooks = function sendGroupChatReceivedWebhooks (chat) {
  const query = {
    webhooks: {
      $elemMatch: {
        type: 'groupChatReceived',
        'options.groupId': this._id,
      },
    },
  };

  if (this.type === 'party') {
    query['party._id'] = this._id;
  } else {
    query.guilds = this._id;
  }

  User.find(query).select({ webhooks: 1 }).lean().exec()
    .then(users => {
      users.forEach(user => {
        groupChatReceivedWebhook.send(user, {
          group: this,
          chat,
        });
      });
    })
    .catch(err => logger.error(err));
};

schema.statics.cleanQuestParty = _cleanQuestParty;
schema.statics.cleanQuestUser = _cleanQuestUser;

// returns a clean object for group.quest
schema.statics.cleanGroupQuest = function cleanGroupQuest () {
  return {
    key: null,
    active: false,
    leader: null,
    progress: {
      collect: {},
    },
    members: {},
  };
};

function _getUserUpdateForQuestReward (itemToAward, allAwardedItems) {
  let updates = {
    $set: {},
    $inc: {},
  };
  const dropK = itemToAward.key;

  switch (itemToAward.type) { // eslint-disable-line default-case
    case 'gear': {
      // TODO This means they can lose their new gear on death, is that what we want?
      updates.$set[`items.gear.owned.${dropK}`] = true;
      break;
    }
    case 'eggs':
    case 'food':
    case 'hatchingPotions':
    case 'quests': {
      updates.$inc[`items.${itemToAward.type}.${dropK}`] = _.filter(allAwardedItems, { type: itemToAward.type, key: itemToAward.key }).length;
      break;
    }
    case 'pets': {
      updates.$set[`items.pets.${dropK}`] = 5;
      break;
    }
    case 'mounts': {
      updates.$set[`items.mounts.${dropK}`] = true;
      break;
    }
  }
  updates = _.omitBy(updates, _.isEmpty);
  return updates;
}

async function _updateUserWithRetries (userId, updates, numTry = 1, query = {}) {
  query._id = userId;
  try {
    return await User.update(query, updates).exec();
  } catch (err) {
    if (numTry < MAX_UPDATE_RETRIES) {
      numTry += 1; // eslint-disable-line no-param-reassign
      return _updateUserWithRetries(userId, updates, numTry, query);
    }
    throw err;
  }
}

// Participants: Grant rewards & achievements, finish quest.
// Changes the group object update members
schema.methods.finishQuest = async function finishQuest (quest) {
  const questK = quest.key;
  const updates = {
    $inc: {
      [`achievements.quests.${questK}`]: 1,
      'stats.gp': Number(quest.drop.gp),
      'stats.exp': Number(quest.drop.exp),
    },
    $set: {},
  };

  if (this._id === TAVERN_ID) {
    updates.$set['party.quest.completed'] = questK; // Just show the notif
  } else {
    _.merge(updates, _cleanQuestParty({ $set: { 'party.quest.completed': questK } })); // clear quest progress
  }

  _.each(_.reject(quest.drop.items, 'onlyOwner'), item => {
    _.merge(updates, _getUserUpdateForQuestReward(item, quest.drop.items));
  });

  const questOwnerUpdates = {};
  const questLeader = this.quest.leader;

  _.each(_.filter(quest.drop.items, 'onlyOwner'), item => {
    _.merge(questOwnerUpdates, _getUserUpdateForQuestReward(item, quest.drop.items));
  });
  _.merge(questOwnerUpdates, updates);

  const participants = this._id === TAVERN_ID ? {} : this.getParticipatingQuestMembers();
  this.quest = {};
  this.markModified('quest');

  if (this._id === TAVERN_ID) {
    return User.update({}, updates, { multi: true }).exec();
  }

  const promises = participants.map(userId => {
    if (userId === questLeader) {
      return _updateUserWithRetries(userId, questOwnerUpdates);
    }
    return _updateUserWithRetries(userId, updates);
  });

  // Send webhooks in background
  // @TODO move the find users part to a worker as well, not just the http request
  User.find({
    _id: { $in: participants },
    webhooks: {
      $elemMatch: {
        type: 'questActivity',
        'options.questFinished': true,
      },
    },
  })
    .select('_id webhooks')
    .lean()
    .exec()
    .then(participantsWithWebhook => {
      participantsWithWebhook.forEach(participantWithWebhook => {
        // Send webhooks
        questActivityWebhook.send(participantWithWebhook, {
          type: 'questFinished',
          group: this,
          quest,
        });
      });
    })
    .catch(err => logger.error(err));

  _.forEach(questSeriesAchievements, (questList, achievement) => {
    if (questList.includes(questK)) {
      const questAchievementQuery = {};
      questAchievementQuery[`achievements.${achievement}`] = { $ne: true };

      _.forEach(questList, questName => {
        if (questName !== questK) {
          questAchievementQuery[`achievements.quests.${questName}`] = { $gt: 0 };
        }
      });

      const questAchievementUpdate = { $set: {}, $push: {} };
      questAchievementUpdate.$set[`achievements.${achievement}`] = true;
      const achievementTitleCase = `${achievement.slice(0, 1).toUpperCase()}${achievement.slice(1, achievement.length)}`;
      const achievementSnakeCase = `ACHIEVEMENT_${_.snakeCase(achievement).toUpperCase()}`;
      questAchievementUpdate.$push = {
        notifications: new UserNotification({
          type: achievementSnakeCase,
          data: {
            achievement,
            message: `${shared.i18n.t('modalAchievement')} ${shared.i18n.t(`achievement${achievementTitleCase}`)}`,
            modalText: shared.i18n.t(`achievement${achievementTitleCase}ModalText`),
          },
        }).toObject(),
      };

      promises.push(participants.map(userId => _updateUserWithRetries(
        userId, questAchievementUpdate, null, questAchievementQuery,
      )));
    }
  });

  return Promise.all(promises);
};

function _isOnQuest (user, progress, group) {
  return group && progress && group.quest && group.quest.active
    && group.quest.members[user._id] === true;
}

schema.methods._processBossQuest = async function processBossQuest (options) {
  const {
    user,
    progress,
  } = options;

  const group = this;
  const quest = questScrolls[group.quest.key];
  const down = progress.down * quest.boss.str; // multiply by boss strength
  // Everyone takes damage
  const updates = {
    $inc: { 'stats.hp': down },
  };
  const promises = [];

  group.quest.progress.hp -= progress.up;
  if (CRON_SAFE_MODE || CRON_SEMI_SAFE_MODE) {
    const groupMessage = group.sendChat({
      message: `\`${shared.i18n.t('chatBossDontAttack', { bossName: quest.boss.name('en') }, 'en')}\``,
      info: {
        type: 'boss_dont_attack',
        user: user.profile.name,
        quest: group.quest.key,
        userDamage: progress.up.toFixed(1),
      },
    });
    promises.push(groupMessage.save());
  } else {
    const groupMessage = group.sendChat({
      message: `\`${shared.i18n.t('chatBossDamage', {
        username: user.profile.name, bossName: quest.boss.name('en'), userDamage: progress.up.toFixed(1), bossDamage: Math.abs(down).toFixed(1),
      }, user.preferences.language)}\``,
      info: {
        type: 'boss_damage',
        user: user.profile.name,
        quest: group.quest.key,
        userDamage: progress.up.toFixed(1),
        bossDamage: Math.abs(down).toFixed(1),
      },
    });
    promises.push(groupMessage.save());
  }

  // If boss has Rage, increment Rage as well
  if (quest.boss.rage) {
    group.quest.progress.rage += Math.abs(down);
    if (group.quest.progress.rage >= quest.boss.rage.value) {
      const rageMessage = group.sendChat({
        message: quest.boss.rage.effect('en'),
        info: {
          type: 'boss_rage',
          quest: quest.key,
        },
      });
      promises.push(rageMessage.save());
      group.quest.progress.rage = 0;

      // TODO To make Rage effects more expandable,
      // let's turn these into functions in quest.boss.rage
      if (quest.boss.rage.healing) {
        group.quest.progress.hp += group.quest.progress.hp * quest.boss.rage.healing;
      }
      if (group.quest.progress.hp > quest.boss.hp) group.quest.progress.hp = quest.boss.hp;
      if (quest.boss.rage.mpDrain) {
        updates.$set = { 'stats.mp': 0 };
      }
      if (quest.boss.rage.progressDrain) {
        updates.$mul = { 'party.quest.progress.up': quest.boss.rage.progressDrain };
      }
    }
  }

  await User.updateMany(
    {
      _id:
      { $in: this.getParticipatingQuestMembers() },
    },
    updates,
  ).exec();
  // Apply changes the currently cronning user locally
  // so we don't have to reload it to get the updated state
  // TODO how to mark not modified? https://github.com/Automattic/mongoose/pull/1167
  // must be notModified or otherwise could overwrite future changes:
  // if the user is saved it'll save
  // the modified user.stats.hp but that must not happen as the hp value has already been updated
  // by the User.update above
  // if (down) user.stats.hp += down;

  // Boss slain, finish quest
  if (group.quest.progress.hp <= 0) {
    const questFinishChat = group.sendChat({
      message: `\`${shared.i18n.t('chatBossDefeated', { bossName: quest.boss.name('en') }, 'en')}\``,
      info: {
        type: 'boss_defeated',
        quest: quest.key,
      },
    });
    promises.push(questFinishChat.save());

    // Participants: Grant rewards & achievements, finish quest
    await group.finishQuest(shared.content.quests[group.quest.key]);
  }

  promises.unshift(group.save());
  return Promise.all(promises);
};

schema.methods._processCollectionQuest = async function processCollectionQuest (options) {
  const {
    user,
    progress,
  } = options;

  const group = this;
  const quest = questScrolls[group.quest.key];
  const itemsFound = {};
  Object.keys(quest.collect).forEach(item => {
    itemsFound[item] = 0;
  });

  // Create an array of item names, one item name per item that still needs to
  // be collected so that items are found proportionally to how many are needed.
  const remainingItems = [].concat(...Object.keys(quest.collect).map(item => {
    let count = quest.collect[item].count - (group.quest.progress.collect[item] || 0);
    if (count < 0) { // This could only happen if there's a bug, but just in case.
      count = 0;
    }
    return Array(count).fill(item);
  }));

  // slice() will grab only what is available even if requested slice is larger
  // than the array, so we don't need to worry about overfilling quest items.
  const collectedItems = _.shuffle(remainingItems).slice(0, progress.collectedItems);
  collectedItems.forEach(item => {
    itemsFound[item] += 1;
    group.quest.progress.collect[item] += 1;
  });

  let foundText = _.reduce(itemsFound, (m, v, k) => {
    m.push(`${v} ${quest.collect[k].text('en')}`);
    return m;
  }, []);

  foundText = foundText.join(', ');
  const foundChat = group.sendChat({
    message: `\`${shared.i18n.t('chatFindItems', { username: user.profile.name, items: foundText }, 'en')}\``,
    info: {
      type: 'user_found_items',
      user: user.profile.name,
      quest: quest.key,
      items: itemsFound,
    },
  });
  group.markModified('quest.progress.collect');

  const promises = [group.save(), foundChat.save()];

  const questFinished = collectedItems.length === remainingItems.length;
  if (questFinished) {
    await group.finishQuest(quest);
    const allItemsFoundChat = group.sendChat({
      message: `\`${shared.i18n.t('chatItemQuestFinish', 'en')}\``,
      info: {
        type: 'all_items_found',
      },
    });

    promises.push(allItemsFoundChat.save());
  }

  return Promise.all(promises);
};

schema.statics.processQuestProgress = async function processQuestProgress (user, progress) {
  if (user.preferences.sleep) return;

  const group = await this.getGroup({ user, groupId: 'party' });

  if (!_isOnQuest(user, progress, group)) return;

  const quest = shared.content.quests[group.quest.key];

  if (!quest) return; // TODO should this throw an error instead?

  const questType = quest.boss ? 'Boss' : 'Collection';

  await group[`_process${questType}Quest`]({ // _processBossQuest, _processCollectionQuest
    user,
    progress,
    group,
  });
};

// to set a boss:
// `db.groups.update({_id:TAVERN_ID},
// {$set:{quest:{key:'dilatory',active:true,progress:{hp:1000,rage:1500}}}}).exec()`
// we export an empty object that is then populated with the query-returned data
export const tavernQuest = {};
const tavernQ = { _id: TAVERN_ID, 'quest.key': { $ne: null } };

// we use process.nextTick because at this point the model is not yet available
process.nextTick(() => {
  model // eslint-disable-line no-use-before-define
    .findOne(tavernQ).exec()
    .then(tavern => {
      if (!tavern) return; // No tavern quest

      // Using _assign so we don't lose the reference to the exported tavernQuest
      _.assign(tavernQuest, tavern.quest.toObject());
    })
    .catch(err => {
      throw err;
    });
});

// returns a promise
schema.statics.tavernBoss = async function tavernBoss (user, progress) {
  if (!progress) return null;
  if (user.preferences.sleep) return null;

  // hack: prevent crazy damage to world boss
  const dmg = Math.min(900, Math.abs(progress.up || 0));
  const rage = -Math.min(900, Math.abs(progress.down || 0));

  const tavern = await this.findOne(tavernQ).exec();
  if (!(tavern && tavern.quest && tavern.quest.key)) return null;

  const quest = shared.content.quests[tavern.quest.key];

  const chatPromises = [];

  if (tavern.quest.progress.hp <= 0) {
    const completeChat = tavern.sendChat({
      message: quest.completionChat('en'),
      info: {
        type: 'tavern_quest_completed',
        quest: quest.key,
      },
    });
    chatPromises.push(completeChat.save());
    await tavern.finishQuest(quest);
    _.assign(tavernQuest, { extra: null });
    return tavern.save();
  }

  // Deal damage. Note a couple things here, str & def are calculated.
  // If str/def are defined in the database,
  // use those first - which allows us to update the boss on the go if things are too easy/hard.
  if (!tavern.quest.extra) tavern.quest.extra = {};
  tavern.quest.progress.hp -= dmg / (tavern.quest.extra.def || quest.boss.def);
  tavern.quest.progress.rage -= rage * (tavern.quest.extra.str || quest.boss.str);

  if (tavern.quest.progress.rage >= quest.boss.rage.value) {
    if (!tavern.quest.extra.worldDmg) tavern.quest.extra.worldDmg = {};

    const wd = tavern.quest.extra.worldDmg;
    // Dysheartener attacks Seasonal Sorceress, Alex, Ian
    let scene;
    if (wd.quests) {
      scene = false;
    } else if (wd.market) {
      scene = 'quests';
    } else if (wd.seasonalShop) {
      scene = 'market';
    } else {
      scene = 'seasonalShop';
    }

    if (!scene) {
      const tiredChat = tavern.sendChat({
        message: `\`${shared.i18n.t('tavernBossTired', { rageName: quest.boss.rage.title('en'), bossName: quest.boss.name('en') }, 'en')}\``,
        info: {
          type: 'tavern_boss_rage_tired',
          quest: quest.key,
        },
      });
      chatPromises.push(tiredChat.save());
      tavern.quest.progress.rage = 0; // quest.boss.rage.value;
    } else {
      const rageChat = tavern.sendChat({
        message: quest.boss.rage[scene]('en'),
        info: {
          type: 'tavern_boss_rage',
          quest: quest.key,
          scene,
        },
      });
      chatPromises.push(rageChat.save());
      tavern.quest.extra.worldDmg[scene] = true;
      tavern.markModified('quest.extra.worldDmg');
      tavern.quest.progress.rage = 0;
      if (quest.boss.rage.healing) {
        tavern.quest.progress.hp += quest.boss.rage.healing * tavern.quest.progress.hp;
      }
    }
  }

  if (
    quest.boss.desperation
    && tavern.quest.progress.hp < quest.boss.desperation.threshold
    && !tavern.quest.extra.desperate
  ) {
    const progressChat = tavern.sendChat({
      message: quest.boss.desperation.text('en'),
      info: {
        type: 'tavern_boss_desperation',
        quest: quest.key,
      },
    });
    chatPromises.push(progressChat.save());
    tavern.quest.extra.desperate = true;
    tavern.quest.extra.def = quest.boss.desperation.def;
    tavern.quest.extra.str = quest.boss.desperation.str;
    tavern.markModified('quest.extra');
  }

  _.assign(tavernQuest, tavern.quest.toObject());

  chatPromises.unshift(tavern.save());
  return Promise.all(chatPromises);
};

schema.methods.leave = async function leaveGroup (user, keep = 'keep-all', keepChallenges = 'leave-challenges') {
  const group = this;
  const update = {};

  if (group.memberCount <= 1 && group.privacy === 'private' && group.hasNotCancelled()) {
    throw new NotAuthorized(shared.i18n.t('cannotDeleteActiveGroup'));
  }

  if (group.leader === user._id && group.hasNotCancelled()) {
    throw new NotAuthorized(shared.i18n.t('leaderCannotLeaveGroupWithActiveGroup'));
  }

  // only remove user from challenges if it's set to leave-challenges
  if (keepChallenges === 'leave-challenges') {
    const challenges = await Challenge.find({
      _id: { $in: user.challenges },
      group: group._id,
    }).exec();

    const challengesToRemoveUserFrom = challenges.map(chal => chal.unlinkTasks(user, keep, false));
    await Promise.all(challengesToRemoveUserFrom);
  }

  // Unlink group tasks
  const assignedTasks = await Tasks.Task.find({
    'group.id': group._id,
    userId: { $exists: false },
    'group.assignedUsers': user._id,
  }).exec();
  const assignedTasksToRemoveUserFrom = assignedTasks
    .map(task => this.unlinkTask(task, user, keep, false));
  await Promise.all(assignedTasksToRemoveUserFrom);

  this.unlinkTags(user);

  // the user could be modified by calls to `unlinkTask` for challenge and group tasks
  // it has not been saved before to avoid multiple saves in parallel
  const promises = user.isModified() ? [user.save()] : [];

  // remove the group from the user's groups
  if (group.type === 'guild') {
    promises.push(User.update({ _id: user._id }, { $pull: { guilds: group._id } }).exec());
  } else {
    promises.push(User.update({ _id: user._id }, { $set: { party: {} } }).exec());

    update.$unset = { [`quest.members.${user._id}`]: 1 };
  }

  if (group.purchased.plan.customerId) {
    promises.push(payments.cancelGroupSubscriptionForUser(user, this));
  }

  // If user is the last one in group and group is private, delete it
  if (group.memberCount <= 1 && group.privacy === 'private') {
    // double check the member count is correct
    // so we don't accidentally delete a group that still has users in it
    let members;
    if (group.type === 'guild') {
      members = await User.find({ guilds: group._id }).select('_id').exec();
    } else {
      members = await User.find({ 'party._id': group._id }).select('_id').exec();
    }
    _.remove(members, { _id: user._id });

    if (members.length === 0) {
      promises.push(group.remove());
      return Promise.all(promises);
    }
  }
  // otherwise If the leader is leaving
  // (or if the leader previously left, and this wasn't accounted for)
  update.$inc = { memberCount: -1 };
  if (group.leader === user._id) {
    const query = group.type === 'party' ? { 'party._id': group._id } : { guilds: group._id };
    query._id = { $ne: user._id };
    const seniorMember = await User.findOne(query).select('_id').exec();

    // could be missing in case of public guild (that can have 0 members)
    // with 1 member who is leaving
    if (seniorMember) update.$set = { leader: seniorMember._id };
  }
  promises.push(group.update(update).exec());

  return Promise.all(promises);
};

schema.methods.unlinkTags = function unlinkTags (user) {
  const group = this;
  user.tags.forEach(tag => {
    if (tag.group && tag.group === group._id) {
      tag.group = undefined;
    }
  });
};

/**
 * Updates all linked tasks for a group task
 *
 * @param  taskToSync  The group task that will be synced
 * @param  options.newCheckListItem  The new checklist item
 *          that needs to be synced to all assigned users
 * @param  options.removedCheckListItem  The removed checklist item that
 *          needs to be removed from all assigned users
 *
 * @return The created tasks
 */
schema.methods.updateTask = async function updateTask (taskToSync, options = {}) {
  const group = this;

  const updateCmd = { $set: {} };

  const syncableAttributes = syncableAttrs(taskToSync);
  for (const key of Object.keys(syncableAttributes)) {
    updateCmd.$set[key] = syncableAttributes[key];
  }

  updateCmd.$set['group.approval.required'] = taskToSync.group.approval.required;
  updateCmd.$set['group.assignedUsers'] = taskToSync.group.assignedUsers;
  updateCmd.$set['group.sharedCompletion'] = taskToSync.group.sharedCompletion;
  updateCmd.$set['group.managerNotes'] = taskToSync.group.managerNotes;

  const taskSchema = Tasks[taskToSync.type];

  const updateQuery = {
    userId: { $exists: true },
    'group.id': group.id,
    'group.taskId': taskToSync._id,
  };

  if (options.newCheckListItem) {
    const newCheckList = { completed: false };
    newCheckList.linkId = options.newCheckListItem.id;
    newCheckList.text = options.newCheckListItem.text;
    updateCmd.$push = { checklist: newCheckList };
  }

  if (options.removedCheckListItemId) {
    updateCmd.$pull = { checklist: { linkId: { $in: [options.removedCheckListItemId] } } };
  }

  if (options.updateCheckListItems) {
    updateCmd.$set.checklist = taskToSync.checklist;
  }

  // Updating instead of loading and saving for performances,
  // risks becoming a problem if we introduce more complexity in tasks
  await taskSchema.update(updateQuery, updateCmd, { multi: true }).exec();
};

schema.methods.syncTask = async function groupSyncTask (taskToSync, user, assigningUser) {
  const group = this;
  const toSave = [];

  if (taskToSync.group.assignedUsers.indexOf(user._id) === -1) {
    taskToSync.group.assignedUsers.push(user._id);
  }

  // Sync tags
  const userTags = user.tags;
  const i = _.findIndex(userTags, { id: group._id });

  if (i !== -1) {
    if (userTags[i].name !== group.name) {
      // update the name - it's been changed since
      userTags[i].name = group.name;
      userTags[i].group = group._id;
    }
  } else {
    userTags.push({
      id: group._id,
      name: group.name,
      group: group._id,
    });
  }

  const findQuery = {
    'group.taskId': taskToSync._id,
    userId: user._id,
    'group.id': group._id,
  };

  let matchingTask = await Tasks.Task.findOne(findQuery).exec();

  if (!matchingTask) { // If the task is new, create it
    matchingTask = new Tasks[taskToSync.type](Tasks.Task.sanitize(syncableAttrs(taskToSync)));
    matchingTask.group.id = taskToSync.group.id;
    matchingTask.userId = user._id;
    matchingTask.group.taskId = taskToSync._id;
    matchingTask.group.assignedDate = new Date();
    user.tasksOrder[`${taskToSync.type}s`].unshift(matchingTask._id);
  } else {
    _.merge(matchingTask, syncableAttrs(taskToSync));
    // Make sure the task is in user.tasksOrder
    const orderList = user.tasksOrder[`${taskToSync.type}s`];
    if (orderList.indexOf(matchingTask._id) === -1 && (matchingTask.type !== 'todo' || !matchingTask.completed)) orderList.push(matchingTask._id);
  }

  matchingTask.group.approval.required = taskToSync.group.approval.required;
  matchingTask.group.assignedUsers = taskToSync.group.assignedUsers;
  matchingTask.group.sharedCompletion = taskToSync.group.sharedCompletion;
  matchingTask.group.managerNotes = taskToSync.group.managerNotes;
  if (assigningUser && user._id !== assigningUser._id) {
    matchingTask.group.assigningUsername = assigningUser.auth.local.username;
  }

  //  sync checklist
  if (taskToSync.checklist) {
    taskToSync.checklist.forEach(element => {
      const newCheckList = { completed: false };
      newCheckList.linkId = element.id;
      newCheckList.text = element.text;
      matchingTask.checklist.push(newCheckList);
    });
  }

  // don't override the notes, but provide it if not provided
  if (!matchingTask.notes) matchingTask.notes = taskToSync.notes;
  // add tag if missing
  if (matchingTask.tags.indexOf(group._id) === -1) matchingTask.tags.push(group._id);

  toSave.push(matchingTask.save(), taskToSync.save(), user.save());
  return Promise.all(toSave);
};

schema.methods.unlinkTask = async function groupUnlinkTask (
  unlinkingTask, user,
  keep, saveUser = true,
) {
  const findQuery = {
    'group.taskId': unlinkingTask._id,
    userId: user._id,
  };

  const assignedUserIndex = unlinkingTask.group.assignedUsers.indexOf(user._id);
  unlinkingTask.group.assignedUsers.splice(assignedUserIndex, 1);

  if (keep === 'keep-all') {
    await Tasks.Task.update(findQuery, {
      $set: { group: {} },
    }).exec();

    // When multiple tasks are being unlinked at the same time,
    // save the user once outside of this function
    if (saveUser) await user.save();
  } else { // keep = 'remove-all'
    const task = await Tasks.Task.findOne(findQuery).select('_id type completed').exec();
    // Remove task from user.tasksOrder and delete them
    if (task && (task.type !== 'todo' || !task.completed)) {
      removeFromArray(user.tasksOrder[`${task.type}s`], task._id);
      user.markModified('tasksOrder');
    }

    const promises = [unlinkingTask.save()];
    if (task) {
      promises.push(task.remove());
    }
    // When multiple tasks are being unlinked at the same time,
    // save the user once outside of this function
    if (saveUser) promises.push(user.save());

    await Promise.all(promises);
  }
};

schema.methods.removeTask = async function groupRemoveTask (task) {
  const group = this;
  const removalPromises = [];

  // Delete individual task copies and related notifications
  const userTasks = await Tasks.Task.find({
    userId: { $exists: true },
    'group.id': group.id,
    'group.taskId': task._id,
  }, { userId: 1, _id: 1 }).exec();

  userTasks.forEach(async userTask => {
    const assignedUser = await User.findOne({ _id: userTask.userId }, 'notifications tasksOrder').exec();

    let notificationIndex = assignedUser.notifications.findIndex(notification => notification
      && notification.type === 'GROUP_TASK_ASSIGNED'
      && notification.data && notification.data.taskId === task._id);

    if (notificationIndex !== -1) {
      assignedUser.notifications.splice(notificationIndex, 1);
    }

    notificationIndex = assignedUser.notifications.findIndex(notification => notification
      && notification.type === 'GROUP_TASK_NEEDS_WORK'
      && notification.data && notification.data.task
      && notification.data.task.id === userTask._id);

    if (notificationIndex !== -1) {
      assignedUser.notifications.splice(notificationIndex, 1);
    }

    notificationIndex = assignedUser.notifications.findIndex(notification => notification
      && notification.type === 'GROUP_TASK_APPROVED'
      && notification.data && notification.data.task
      && notification.data.task._id === userTask._id);

    if (notificationIndex !== -1) {
      assignedUser.notifications.splice(notificationIndex, 1);
    }

    await Tasks.Task.remove({ _id: userTask._id });
    removeFromArray(assignedUser.tasksOrder[`${task.type}s`], userTask._id);
    removalPromises.push(assignedUser.save());
  });

  // Get Managers
  const managerIds = Object.keys(group.managers);
  managerIds.push(group.leader);
  const managers = await User.find({ _id: managerIds }, 'notifications').exec(); // Use this method so we can get access to notifications

  // Remove old notifications
  managers.forEach(manager => {
    const notificationIndex = manager.notifications.findIndex(notification => notification
      && notification.data && notification.data.groupTaskId === task._id
      && notification.type === 'GROUP_TASK_APPROVAL');

    if (notificationIndex !== -1) {
      manager.notifications.splice(notificationIndex, 1);
    }
    removalPromises.push(manager.save());
  });

  removeFromArray(group.tasksOrder[`${task.type}s`], task._id);
  group.markModified('tasksOrder');
  removalPromises.push(group.save());

  return Promise.all(removalPromises);
};

// Returns true if the user has reached the spam message limit
schema.methods.checkChatSpam = function groupCheckChatSpam (user) {
  if (this._id !== TAVERN_ID) {
    return false;
  } if (user.contributor && user.contributor.level >= SPAM_MIN_EXEMPT_CONTRIB_LEVEL) {
    return false;
  }

  const currentTime = Date.now();
  let userMessages = 0;
  for (let i = 0; i < this.chat.length; i += 1) {
    const message = this.chat[i];
    if (message.uuid === user._id && currentTime - message.timestamp <= SPAM_WINDOW_LENGTH) {
      userMessages += 1;
      if (userMessages >= SPAM_MESSAGE_LIMIT) {
        return true;
      }
    } else if (currentTime - message.timestamp > SPAM_WINDOW_LENGTH) {
      break;
    }
  }

  return false;
};

schema.methods.hasActiveGroupPlan = function hasActiveGroupPlan () {
  const now = new Date();
  const { plan } = this.purchased;
  return plan && plan.customerId
    && (!plan.dateTerminated || moment(plan.dateTerminated).isAfter(now));
};

schema.methods.hasNotCancelled = function hasNotCancelled () {
  const { plan } = this.purchased;
  return Boolean(this.hasActiveGroupPlan() && !plan.dateTerminated);
};

schema.methods.hasCancelled = function hasCancelled () {
  const { plan } = this.purchased;
  return Boolean(this.hasActiveGroupPlan() && plan.dateTerminated);
};

schema.methods.updateGroupPlan = async function updateGroupPlan (removingMember) {
  // Recheck the group plan count
  this.memberCount = await this.getMemberCount();

  if (this.purchased.plan.paymentMethod === stripePayments.constants.PAYMENT_METHOD) {
    await stripePayments.chargeForAdditionalGroupMember(this);
  } else if (
    this.purchased.plan.paymentMethod === amazonPayments.constants.PAYMENT_METHOD
    && !removingMember
  ) {
    await amazonPayments.chargeForAdditionalGroupMember(this);
  }
};

export const model = mongoose.model('Group', schema);

// initialize tavern if !exists (fresh installs)
// do not run when testing as it's handled by the tests and can easily cause a race condition
if (!nconf.get('IS_TEST')) {
  model.countDocuments({ _id: TAVERN_ID }, (err, ct) => {
    if (err) throw err;
    if (ct > 0) return;
    new model({ // eslint-disable-line new-cap
      _id: TAVERN_ID,
      leader: '7bde7864-ebc5-4ee2-a4b7-1070d464cdb0', // Siena Leslie
      name: 'Tavern',
      type: 'guild',
      privacy: 'public',
    }).save();
  });
}
