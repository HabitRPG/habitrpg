import { authWithHeaders } from '../../middlewares/auth';
import couponsLib from '../../libs/coupons';

/*
* NOTE most coupon routes are still in the v3 controller
* here there are only routes that had to be split from the v3 version because of
* some breaking change.
*/

const api = {};

/* NOTE this route has also an API v3 version */

/**
 * @api {post} /api/v4/coupons/enter/:code Redeem a coupon code
 * @apiName RedeemCouponCode
 * @apiGroup Coupon
 *
 * @apiParam (Path) {String} code The coupon code to apply
 *
 * @apiSuccess {Object} data User object
 */
api.enterCouponCode = {
  method: 'POST',
  url: '/coupons/enter/:code',
  middlewares: [authWithHeaders()],
  async handler (req, res) {
    const user = res.locals.user;
    await couponsLib.enterCode(req, res, user);
    res.respond(200, user);
  },
};

module.exports = api;