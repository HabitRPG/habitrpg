var express = require('express');
var router = new express.Router();
var auth = require('../controllers/auth');
var coupon = require('../controllers/coupon');
var i18n = require('../i18n');

router.get('/api/v2/coupons', auth.authWithUrl, i18n.getUserLanguage, coupon.ensureAdmin, coupon.getCoupons);
router.post('/api/v2/coupons/generate/:event', auth.auth, i18n.getUserLanguage, coupon.ensureAdmin, coupon.generateCoupons);
router.post('/api/v2/user/coupon/:code', auth.auth, i18n.getUserLanguage, coupon.enterCode);

module.exports = router;