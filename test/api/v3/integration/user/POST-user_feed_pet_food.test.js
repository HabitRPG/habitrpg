/* eslint-disable camelcase */

import {
  generateUser,
  translate as t,
} from '../../../../helpers/api-integration/v3';
import content from '../../../../../common/script/content';

describe('POST /user/feed/:pet/:food', () => {
  let user;

  beforeEach(async () => {
    user = await generateUser();
  });

  // More tests in common code unit tests

  it('does not enjoy the food', async () => {
    await user.update({
      'items.pets.Wolf-Base': 5,
      'items.food.Milk': 2,
    });

    let food = content.food.Milk;
    let [egg, potion] = 'Wolf-Base'.split('-');
    potion = content.hatchingPotions[potion];
    egg = content.eggs[egg];

    let res = await user.post('/user/feed/Wolf-Base/Milk');
    await user.sync();
    expect(res).to.eql({
      data: user.items.pets['Wolf-Base'],
      message: t('messageDontEnjoyFood', {
        egg: t('petName', {
          potion: potion.text,
          egg: egg.text,
        }),
        foodText: food.text(),
      }),
    });

    expect(user.items.food.Milk).to.equal(1);
    expect(user.items.pets['Wolf-Base']).to.equal(7);
  });
});
