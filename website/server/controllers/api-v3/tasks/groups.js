import { authWithHeaders } from '../../../middlewares/api-v3/auth';
import { sendTaskWebhook } from '../../../libs/api-v3/webhook';
import { removeFromArray } from '../../../libs/api-v3/collectionManipulators';
import * as Tasks from '../../../models/task';
import { model as Challenge } from '../../../models/challenge';
import { model as Group } from '../../../models/group';
import {
  NotFound,
  NotAuthorized,
  BadRequest,
} from '../../../libs/api-v3/errors';
import {
  _createTasks,
  _getTasks,
} from '../../../libs/api-v3/taskManager';
import common from '../../../../../common';
import Bluebird from 'bluebird';
import _ from 'lodash';
import logger from '../../../libs/api-v3/logger';

let api = {};

/**
 * @api {post} /api/v3/tasks/group/:groupId Create a new task belonging to a group
 * @apiDescription Can be passed an object to create a single task or an array of objects to create multiple tasks.
 * @apiVersion 3.0.0
 * @apiName CreateGroupTasks
 * @apiGroup Task
 *
 * @apiParam {UUID} groupId The id of the group the new task(s) will belong to
 *
 * @apiSuccess data An object if a single task was created, otherwise an array of tasks
 */
api.createGroupTasks = {
  method: 'POST',
  url: '/tasks/group/:groupId',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    // req.checkParams('groupId', res.t('groupIdRequired')).notEmpty().isUUID();

    let reqValidationErrors = req.validationErrors();
    if (reqValidationErrors) throw reqValidationErrors;

    let user = res.locals.user;

    let group = await Group.getGroup({user, groupId: req.params.groupId, populateLeader: false});
    if (!group) throw new NotFound(res.t('groupNotFound'));

    if (group.leader !== user._id) throw new NotAuthorized(res.t('onlyGroupLeaderEditTasks'));

    let tasks = await _createTasks(req, res, {user, null, group});

    res.respond(201, tasks.length === 1 ? tasks[0] : tasks);

    return null;
  },
};

/**
 * @api {get} /api/v3/tasks/group/:groupId Get a group's tasks
 * @apiVersion 3.0.0
 * @apiName GetGroupTasks
 * @apiGroup Task
 *
 * @apiParam {UUID} groupId The id of the group from which to retrieve the tasks
 * @apiParam {string="habits","dailys","todos","rewards"} type Optional query parameter to return just a type of tasks
 *
 * @apiSuccess {Array} data An array of tasks
 */
api.getGroupTasks = {
  method: 'GET',
  url: '/tasks/group/:groupId',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    req.checkParams('groupId', res.t('groupIdRequired')).notEmpty().isUUID();
    let types = Tasks.tasksTypes.map(type => `${type}s`);
    req.checkQuery('type', res.t('invalidTaskType')).optional().isIn(types);

    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    let user = res.locals.user;

    let group = await Group.getGroup({user, groupId: req.params.groupId, populateLeader: false});
    if (!group) throw new NotFound(res.t('groupNotFound'));

    return await _getTasks(req, res, {user, null, group});
  },
};

module.exports = api;
