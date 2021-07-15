<template>
  <div class="row standard-page">
    <div class="col-12">
      <h1>{{ $t('notifications') }}</h1>
    </div>
    <div class="col-12">
      <div class="checkbox">
        <label>
          <input
            v-model="user.preferences.pushNotifications.unsubscribeFromAll"
            type="checkbox"
            class="mr-2"
            @change="set('pushNotifications', 'unsubscribeFromAll')"
          >
          <span>{{ $t('unsubscribeAllPush') }}</span>
        </label>
      </div>
      <br>
      <div class="checkbox">
        <label>
          <input
            v-model="user.preferences.emailNotifications.unsubscribeFromAll"
            type="checkbox"
            class="mr-2"
            @change="set('emailNotifications', 'unsubscribeFromAll')"
          >
          <span>{{ $t('unsubscribeAllEmails') }}</span>
        </label>
      </div>
      <small>{{ $t('unsubscribeAllEmailsText') }}</small>
    </div>
    <div class="col-8">
      <table class="table">
        <tr>
          <td></td>
          <th>
            <span>{{ $t('email') }}</span>
          </th>
          <th>
            <span>{{ $t('push') }}</span>
          </th>
        </tr>
        <tr
          v-for="notification in notificationsIds"
          :key="notification"
        >
          <td>
            <span>{{ $t(notification) }}</span>
          </td>
          <td>
            <input
              v-model="user.preferences.emailNotifications[notification]"
              type="checkbox"
              @change="set('emailNotifications', notification)"
            >
          </td>
          <td v-if="onlyEmailsIds.indexOf(notification) === -1">
            <input
              v-model="user.preferences.pushNotifications[notification]"
              type="checkbox"
              @change="set('pushNotifications', notification)"
            >
          </td><td v-else>
            &nbsp;
          </td>
        </tr>
      </table>
    </div>
  </div>
</template>

<script>
import { mapState } from '@/libs/store';
import notificationsMixin from '@/mixins/notifications';

export default {
  mixins: [notificationsMixin],
  data () {
    return {
      notificationsIds: Object.freeze([
        'majorUpdates',
        'onboarding',
        'newPM',
        'wonChallenge',
        'giftedGems',
        'giftedSubscription',
        'invitedParty',
        'invitedGuild',
        'kickedGroup',
        'questStarted',
        'invitedQuest',
        'importantAnnouncements',
        'weeklyRecaps',
        'subscriptionReminders',
      ]),
      // list of email-only notifications
      onlyEmailsIds: Object.freeze([
        'kickedGroup',
        'importantAnnouncements',
        'weeklyRecaps',
        'onboarding',
        'subscriptionReminders',
      ]),
    };
  },
  computed: {
    ...mapState({ user: 'user.data' }),
  },
  async mounted () {
    this.$store.dispatch('common:setTitle', {
      section: this.$t('settings'),
      subSection: this.$t('notifications'),
    });
    // If ?unsubFrom param is passed with valid email type,
    // automatically unsubscribe users from that email and
    // show an alert

    // A simple object to map the key stored in the db (user.preferences.emailNotification[key])
    // to its string id but ONLY when the preferences' key and the string key don't match
    const MAP_PREF_TO_EMAIL_STRING = {
      importantAnnouncements: 'inactivityEmails',
    };

    const { unsubFrom } = this.$route.query;

    if (unsubFrom) {
      await this.$store.dispatch('user:set', {
        [`preferences.emailNotifications.${unsubFrom}`]: false,
      });

      const emailTypeString = this.$t(MAP_PREF_TO_EMAIL_STRING[unsubFrom] || unsubFrom);
      this.text(this.$t('correctlyUnsubscribedEmailType', { emailType: emailTypeString }));
    }
  },
  methods: {
    set (preferenceType, notification) {
      const settings = {};
      settings[`preferences.${preferenceType}.${notification}`] = this.user.preferences[preferenceType][notification];
      this.$store.dispatch('user:set', settings);
    },
  },
};
</script>
