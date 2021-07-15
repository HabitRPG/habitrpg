// When using a common module from the website or the server NEVER import the module directly
// but access it through `api` (the main common) module,
// otherwise you would require the non transpiled version of the file in production.
import {
  CHAT_FLAG_FROM_MOD,
  CHAT_FLAG_FROM_SHADOW_MUTE,
  CHAT_FLAG_LIMIT_FOR_HIDING,
  GUILDS_PER_PAGE,
  LARGE_GROUP_COUNT_MESSAGE_CUTOFF,
  MAX_HEALTH,
  MAX_INCENTIVES,
  MAX_LEVEL,
  MAX_LEVEL_HARD_CAP,
  MAX_STAT_POINTS,
  MAX_SUMMARY_SIZE_FOR_CHALLENGES,
  MAX_SUMMARY_SIZE_FOR_GUILDS,
  MIN_SHORTNAME_SIZE_FOR_CHALLENGES,
  PARTY_LIMIT_MEMBERS,
  MINIMUM_PASSWORD_LENGTH,
  SUPPORTED_SOCIAL_NETWORKS,
  TAVERN_ID,
  MAX_MESSAGE_LENGTH,
  MAX_GIFT_MESSAGE_LENGTH,
} from './constants';
import content from './content/index';
import * as count from './count';
// TODO under api.libs.cron?
import { daysSince, DAY_MAPPING, shouldDo } from './cron';
import apiErrors from './errors/apiErrorMessages';
import commonErrors from './errors/commonErrorMessages';
import autoAllocate from './fns/autoAllocate';
import crit from './fns/crit';
import getUtcOffset from './fns/getUtcOffset';
import handleTwoHanded from './fns/handleTwoHanded';
import predictableRandom from './fns/predictableRandom';
import randomDrop from './fns/randomDrop';
import resetGear from './fns/resetGear';
import ultimateGear from './fns/ultimateGear';
import updateStats from './fns/updateStats';
import i18n from './i18n';
import achievements from './libs/achievements';
import appliedTags from './libs/appliedTags';
import * as errors from './libs/errors';
import getDebuffPotionItems from './libs/getDebuffPotionItems';
import gold from './libs/gold';
import hasClass from './libs/hasClass';
import inAppRewards from './libs/inAppRewards';
import noTags from './libs/noTags';
import * as onboarding from './libs/onboarding';
import percent from './libs/percent';
import pickDeep from './libs/pickDeep';
import planGemLimits from './libs/planGemLimits';
import preenTodos from './libs/preenTodos';
import randomVal from './libs/randomVal';
import refPush from './libs/refPush';
import setDebuffPotionItems from './libs/setDebuffPotionItems';
import shops from './libs/shops';
import silver from './libs/silver';
import splitWhitespace from './libs/splitWhitespace';
import statsComputed from './libs/statsComputed';
import taskDefaults from './libs/taskDefaults';
import updateStore from './libs/updateStore';
import uuid from './libs/uuid';
import blockUser from './ops/blockUser';
import buy from './ops/buy/buy';
import changeClass from './ops/changeClass';
import disableClasses from './ops/disableClasses';
import equip from './ops/equip';
import feed from './ops/feed';
import hatch from './ops/hatch';
import markPmsRead from './ops/markPMSRead';
import openMysteryItem from './ops/openMysteryItem';
import * as pinnedGearUtils from './ops/pinnedGearUtils';
import readCard from './ops/readCard';
import rebirth from './ops/rebirth';
import releaseBoth from './ops/releaseBoth';
import releaseMounts from './ops/releaseMounts';
import releasePets from './ops/releasePets';
import reroll from './ops/reroll';
import reset from './ops/reset';
import revive from './ops/revive';
import scoreTask from './ops/scoreTask';
import sell from './ops/sell';
import sleep from './ops/sleep';
import allocate from './ops/stats/allocate';
import allocateBulk from './ops/stats/allocateBulk';
import allocateNow from './ops/stats/allocateNow';
import unlock from './ops/unlock';
import updateTask from './ops/updateTask';
// TODO under api.libs.statHelpers?
import * as statHelpers from './statHelpers';
import { unEquipByType } from './ops/unequip';
import getOfficialPinnedItems from './libs/getOfficialPinnedItems';
import { sleepAsync } from './libs/sleepAsync';

const api = {};
api.content = content;
api.errors = errors;
api.i18n = i18n;
api.shouldDo = shouldDo;
api.daysSince = daysSince;
api.DAY_MAPPING = DAY_MAPPING;

api.constants = {
  MAX_INCENTIVES,
  LARGE_GROUP_COUNT_MESSAGE_CUTOFF,
  MAX_SUMMARY_SIZE_FOR_GUILDS,
  MAX_SUMMARY_SIZE_FOR_CHALLENGES,
  MIN_SHORTNAME_SIZE_FOR_CHALLENGES,
  SUPPORTED_SOCIAL_NETWORKS,
  GUILDS_PER_PAGE,
  PARTY_LIMIT_MEMBERS,
  CHAT_FLAG_LIMIT_FOR_HIDING,
  CHAT_FLAG_FROM_MOD,
  CHAT_FLAG_FROM_SHADOW_MUTE,
  MINIMUM_PASSWORD_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_GIFT_MESSAGE_LENGTH,
  MAX_LEVEL_HARD_CAP,
};
// TODO Move these under api.constants
api.maxLevel = MAX_LEVEL;
api.maxHealth = MAX_HEALTH;
api.maxStatPoints = MAX_STAT_POINTS;
api.TAVERN_ID = TAVERN_ID;
api.capByLevel = statHelpers.capByLevel;
api.tnl = statHelpers.toNextLevel;
api.diminishingReturns = statHelpers.diminishingReturns;
api.$w = splitWhitespace;
api.refPush = refPush;
api.planGemLimits = planGemLimits;
api.preenTodos = preenTodos;
api.updateStore = updateStore;
api.inAppRewards = inAppRewards;
api.uuid = uuid;
api.taskDefaults = taskDefaults;
api.percent = percent;
api.gold = gold;
api.silver = silver;
api.noTags = noTags;
api.appliedTags = appliedTags;
api.pickDeep = pickDeep;
api.count = count;
api.statsComputed = statsComputed;
api.shops = shops;
api.achievements = achievements;
api.randomVal = randomVal;
api.hasClass = hasClass;
api.onboarding = onboarding;
api.setDebuffPotionItems = setDebuffPotionItems;
api.getDebuffPotionItems = getDebuffPotionItems;
api.getOfficialPinnedItems = getOfficialPinnedItems;
api.sleepAsync = sleepAsync;

api.fns = {
  autoAllocate,
  crit,
  handleTwoHanded,
  predictableRandom,
  randomDrop,
  resetGear,
  ultimateGear,
  updateStats,
  getUtcOffset,
};

api.ops = {
  scoreTask,
  sleep,
  allocate,
  allocateBulk,
  buy,
  allocateNow,
  hatch,
  feed,
  equip,
  changeClass,
  disableClasses,
  readCard,
  openMysteryItem,
  releasePets,
  releaseBoth,
  releaseMounts,
  updateTask,
  sell,
  unlock,
  revive,
  rebirth,
  blockUser,
  reroll,
  reset,
  markPmsRead,
  pinnedGearUtils,
  unEquipByType,
};

api.errorMessages = {
  common: commonErrors,
  api: apiErrors,
};

export default api;
