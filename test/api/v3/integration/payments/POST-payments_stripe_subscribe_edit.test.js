import {
  generateUser,
} from '../../../../helpers/api-integration/v3';

describe('payments - stripe - #subscribeEdit', () => {
  let endpoint = '/payments/stripe/subscribe/edit';
  let user;

  beforeEach(async () => {
    user = await generateUser();
  });

  it('verifies credentials', async (done) => {
    try {
      await user.post(endpoint);
    } catch (e) {
      expect(e.error).to.eql('BadRequest');
      expect(e.message.type).to.eql('InvalidParameterValue');
      done();
    }
  });
});
