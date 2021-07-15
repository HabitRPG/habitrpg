<template>
  <div class="row standard-page">
    <restore-modal />
    <reset-modal />
    <delete-modal />
    <h1 class="col-12">
      {{ $t('settings') }}
    </h1>
    <div class="col-sm-6">
      <div class="form-horizontal">
        <h5>{{ $t('language') }}</h5>
        <select
          class="form-control"
          :value="user.preferences.language"
          @change="changeLanguage($event)"
        >
          <option
            v-for="lang in availableLanguages"
            :key="lang.code"
            :value="lang.code"
          >
            {{ lang.name }}
          </option>
        </select>
        <small>
          {{ $t('americanEnglishGovern') }}
          <br>
          <strong v-html="$t('helpWithTranslation')"></strong>
        </small>
      </div>
      <hr>
      <div class="form-horizontal">
        <h5>{{ $t('dateFormat') }}</h5>
        <select
          v-model="user.preferences.dateFormat"
          class="form-control"
          @change="set('dateFormat')"
        >
          <option
            v-for="dateFormat in availableFormats"
            :key="dateFormat"
            :value="dateFormat"
          >
            {{ dateFormat }}
          </option>
        </select>
      </div>
      <hr>
      <div class="form-horizontal">
        <div class="form-group">
          <h5>{{ $t('audioTheme') }}</h5>
          <select
            v-model="user.preferences.sound"
            class="form-control"
            @change="changeAudioTheme"
          >
            <option
              v-for="sound in availableAudioThemes"
              :key="sound"
              :value="sound"
            >
              {{ $t(`audioTheme_${sound}`) }}
            </option>
          </select>
        </div>
        <button
          v-once
          class="btn btn-primary btn-xs"
          @click="playAudio"
        >
          {{ $t('demo') }}
        </button>
      </div>
      <hr>
      <div
        v-if="hasClass"
        class="form-horizontal"
      >
        <h5>{{ $t('characterBuild') }}</h5>
        <h6 v-once>
          {{ $t('class') + ': ' }}
          <!-- @TODO: what is classText-->
          <!-- span(v-if='classText') {{ classText }}&nbsp;-->
          <button
            v-once
            class="btn btn-danger btn-xs"
            @click="changeClassForUser(true)"
          >
            {{ $t('changeClass') }}
          </button>
          <small class="cost">
            &nbsp; 3 {{ $t('gems') }}
            <!-- @TODO add icon span.Pet_Currency_Gem1x.inline-gems-->
          </small>
        </h6>
        <hr>
      </div>
      <div>
        <div class="checkbox">
          <label>
            <input
              v-model="user.preferences.advancedCollapsed"
              type="checkbox"
              class="mr-2"
              @change="set('advancedCollapsed')"
            >
            <span
              class="hint"
              popover-trigger="mouseenter"
              popover-placement="right"
              :popover="$t('startAdvCollapsedPop')"
            >{{ $t('startAdvCollapsed') }}</span>
          </label>
        </div>
        <div class="checkbox">
          <label>
            <input
              v-model="user.preferences.dailyDueDefaultView"
              type="checkbox"
              class="mr-2"
              @change="set('dailyDueDefaultView')"
            >
            <span
              class="hint"
              popover-trigger="mouseenter"
              popover-placement="right"
              :popover="$t('dailyDueDefaultViewPop')"
            >{{ $t('dailyDueDefaultView') }}</span>
          </label>
        </div>
        <div
          v-if="party.memberCount === 1"
          class="checkbox"
        >
          <label>
            <input
              v-model="user.preferences.displayInviteToPartyWhenPartyIs1"
              type="checkbox"
              class="mr-2"
              @change="set('displayInviteToPartyWhenPartyIs1')"
            >
            <span
              class="hint"
              popover-trigger="mouseenter"
              popover-placement="right"
              :popover="$t('displayInviteToPartyWhenPartyIs1')"
            >{{ $t('displayInviteToPartyWhenPartyIs1') }}</span>
          </label>
        </div>
        <div class="checkbox">
          <input
            v-model="user.preferences.suppressModals.levelUp"
            type="checkbox"
            class="mr-2"
            @change="set('suppressModals', 'levelUp')"
          >
          <label>{{ $t('suppressLevelUpModal') }}</label>
        </div>
        <div class="checkbox">
          <input
            v-model="user.preferences.suppressModals.hatchPet"
            type="checkbox"
            class="mr-2"
            @change="set('suppressModals', 'hatchPet')"
          >
          <label>{{ $t('suppressHatchPetModal') }}</label>
        </div>
        <div class="checkbox">
          <input
            v-model="user.preferences.suppressModals.raisePet"
            type="checkbox"
            class="mr-2"
            @change="set('suppressModals', 'raisePet')"
          >
          <label>{{ $t('suppressRaisePetModal') }}</label>
        </div>
        <div class="checkbox">
          <input
            v-model="user.preferences.suppressModals.streak"
            type="checkbox"
            class="mr-2"
            @change="set('suppressModals', 'streak')"
          >
          <label>{{ $t('suppressStreakModal') }}</label>
        </div>
        <hr>
        <button
          class="btn btn-primary mr-2 mb-2"
          popover-trigger="mouseenter"
          popover-placement="right"
          :popover="$t('showBaileyPop')"
          @click="showBailey()"
        >
          {{ $t('showBailey') }}
        </button>
        <button
          class="btn btn-primary mr-2 mb-2"
          popover-trigger="mouseenter"
          popover-placement="right"
          :popover="$t('fixValPop')"
          @click="openRestoreModal()"
        >
          {{ $t('fixVal') }}
        </button>
        <button
          v-if="user.preferences.disableClasses == true"
          class="btn btn-primary mb-2"
          popover-trigger="mouseenter"
          popover-placement="right"
          :popover="$t('enableClassPop')"
          @click="changeClassForUser(false)"
        >
          {{ $t('enableClass') }}
        </button>
        <hr>
        <div>
          <h5>{{ $t('customDayStart') }}</h5>
          <div class="alert alert-warning">
            {{ $t('customDayStartInfo1') }}
          </div>
          <div class="form-horizontal">
            <div class="form-group">
              <div class="col-7">
                <select
                  v-model="newDayStart"
                  class="form-control"
                >
                  <option
                    v-for="option in dayStartOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.name }}
                  </option>
                </select>
              </div>
              <div class="col-5">
                <button
                  class="btn btn-block btn-primary mt-1"
                  :disabled="newDayStart === user.preferences.dayStart"
                  @click="openDayStartModal()"
                >
                  {{ $t('saveCustomDayStart') }}
                </button>
              </div>
            </div>
          </div>
          <hr>
        </div>
        <h5>{{ $t('timezone') }}</h5>
        <div class="form-horizontal">
          <div class="form-group">
            <div class="col-12">
              <p v-html="$t('timezoneUTC', {utc: timezoneOffsetToUtc})"></p>
              <p v-html="$t('timezoneInfo')"></p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="col-sm-6">
      <h2>{{ $t('registration') }}</h2>
      <div class="panel-body">
        <div>
          <ul class="list-inline">
            <li
              v-for="network in SOCIAL_AUTH_NETWORKS"
              :key="network.key"
            >
              <button
                v-if="!user.auth[network.key].id"
                class="btn btn-primary mb-2"
                @click="socialAuth(network.key, user)"
              >
                {{ $t('registerWithSocial', {network: network.name}) }}
              </button>
              <button
                v-if="!hasBackupAuthOption(network.key) && user.auth[network.key].id"
                class="btn btn-primary mb-2"
                disabled="disabled"
              >
                {{ $t('registeredWithSocial', {network: network.name}) }}
              </button>
              <button
                v-if="hasBackupAuthOption(network.key) && user.auth[network.key].id"
                class="btn btn-danger"
                @click="deleteSocialAuth(network)"
              >
                {{ $t('detachSocial', {network: network.name}) }}
              </button>
            </li>
          </ul>
          <hr>
          <div v-if="!user.auth.local.email">
            <p>{{ $t('addLocalAuth') }}</p>
            <div
              class="form"
              name="localAuth"
              novalidate="novalidate"
            >
              <div class="form-group">
                <input
                  v-model="localAuth.email"
                  class="form-control"
                  type="text"
                  :placeholder="$t('email')"
                  required="required"
                >
              </div>
              <div class="form-group">
                <input
                  v-model="localAuth.password"
                  class="form-control"
                  type="password"
                  :placeholder="$t('password')"
                  required="required"
                >
              </div>
              <div class="form-group">
                <input
                  v-model="localAuth.confirmPassword"
                  class="form-control"
                  type="password"
                  :placeholder="$t('confirmPass')"
                  required="required"
                >
              </div>
              <button
                class="btn btn-primary"
                type="submit"
                @click="addLocalAuth()"
              >
                {{ $t('submit') }}
              </button>
            </div>
          </div>
        </div>
        <div class="usersettings">
          <h5>{{ $t('changeDisplayName') }}</h5>
          <div
            class="form"
            name="changeDisplayName"
            novalidate="novalidate"
          >
            <div class="form-group">
              <input
                id="changeDisplayname"
                v-model="temporaryDisplayName"
                class="form-control"
                type="text"
                :placeholder="$t('newDisplayName')"
                :class="{'is-invalid input-invalid': displayNameInvalid}"
              >
              <div
                v-if="displayNameIssues.length > 0"
                class="mb-3"
              >
                <div
                  v-for="issue in displayNameIssues"
                  :key="issue"
                  class="input-error"
                >
                  {{ issue }}
                </div>
              </div>
            </div>
            <button
              class="btn btn-primary"
              type="submit"
              :disabled="displayNameCannotSubmit"
              @click="changeDisplayName(temporaryDisplayName)"
            >
              {{ $t('submit') }}
            </button>
          </div>
          <h5>{{ $t('changeUsername') }}</h5>
          <div
            class="form"
            name="changeUsername"
            novalidate="novalidate"
          >
            <div
              v-if="verifiedUsername"
              class="iconalert iconalert-success"
            >
              {{ $t('usernameVerifiedConfirmation', {'username': user.auth.local.username}) }}
            </div>
            <div
              v-else
              class="iconalert iconalert-warning"
            >
              <div class="align-middle">
                <span>{{ $t('usernameNotVerified') }}</span>
              </div>
            </div>
            <div class="form-group">
              <input
                id="changeUsername"
                v-model="usernameUpdates.username"
                class="form-control"
                type="text"
                :placeholder="$t('newUsername')"
                :class="{'is-invalid input-invalid': usernameInvalid}"
                @blur="restoreEmptyUsername()"
              >
              <div
                v-for="issue in usernameIssues"
                :key="issue"
                class="input-error"
              >
                {{ issue }}
              </div>
              <small class="form-text text-muted">{{ $t('changeUsernameDisclaimer') }}</small>
            </div>
            <button
              class="btn btn-primary"
              type="submit"
              :disabled="usernameCannotSubmit"
              @click="changeUser('username', usernameUpdates)"
            >
              {{ $t('saveAndConfirm') }}
            </button>
          </div>
          <h5 v-if="user.auth.local.email">
            {{ $t('changeEmail') }}
          </h5>
          <div
            v-if="user.auth.local.email"
            class="form"
            name="changeEmail"
            novalidate="novalidate"
          >
            <div class="form-group">
              <input
                id="changeEmail"
                v-model="emailUpdates.newEmail"
                class="form-control"
                type="text"
                :placeholder="$t('newEmail')"
              >
            </div>
            <div class="form-group">
              <input
                v-model="emailUpdates.password"
                class="form-control"
                type="password"
                :placeholder="$t('password')"
              >
            </div>
            <button
              class="btn btn-primary"
              type="submit"
              @click="changeUser('email', emailUpdates)"
            >
              {{ $t('submit') }}
            </button>
          </div>
          <h5 v-if="user.auth.local.email">
            {{ $t('changePass') }}
          </h5>
          <div
            v-if="user.auth.local.email"
            class="form"
            name="changePassword"
            novalidate="novalidate"
          >
            <div class="form-group">
              <input
                id="changePassword"
                v-model="passwordUpdates.password"
                class="form-control"
                type="password"
                :placeholder="$t('oldPass')"
              >
            </div>
            <div class="form-group">
              <input
                v-model="passwordUpdates.newPassword"
                class="form-control"
                type="password"
                :placeholder="$t('newPass')"
              >
            </div>
            <div class="form-group">
              <input
                v-model="passwordUpdates.confirmPassword"
                class="form-control"
                type="password"
                :placeholder="$t('confirmPass')"
              >
            </div>
            <button
              class="btn btn-primary"
              type="submit"
              @click="changeUser('password', passwordUpdates)"
            >
              {{ $t('submit') }}
            </button>
          </div>
          <hr>
        </div>
        <div>
          <h5>{{ $t('dangerZone') }}</h5>
          <div>
            <button
              v-b-popover.hover.auto="$t('resetAccPop')"
              class="btn btn-danger mr-2 mb-2"
              popover-trigger="mouseenter"
              popover-placement="right"
              @click="openResetModal()"
            >
              {{ $t('resetAccount') }}
            </button>
            <button
              v-b-popover.hover.auto="$t('deleteAccPop')"
              class="btn btn-danger mb-2"
              popover-trigger="mouseenter"
              @click="openDeleteModal()"
            >
              {{ $t('deleteAccount') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import '~@/assets/scss/colors.scss';

  input {
    color: $gray-50;
  }

  .usersettings h5 {
    margin-top: 1em;
  }

  .iconalert > div > span {
    line-height: 25px;
  }

  .iconalert > div:after {
    clear: both;
    content: '';
    display: table;
  }

  .input-error {
    color: $red-50;
    font-size: 90%;
    width: 100%;
    margin-top: 5px;
  }
</style>

<script>
import hello from 'hellojs';
import moment from 'moment';
import axios from 'axios';
import debounce from 'lodash/debounce';
import { mapState } from '@/libs/store';
import restoreModal from './restoreModal';
import resetModal from './resetModal';
import deleteModal from './deleteModal';
import { SUPPORTED_SOCIAL_NETWORKS } from '@/../../common/script/constants';
import changeClass from '@/../../common/script/ops/changeClass';
import getUtcOffset from '@/../../common/script/fns/getUtcOffset';
import notificationsMixin from '../../mixins/notifications';
import sounds from '../../libs/sounds';
import { buildAppleAuthUrl } from '../../libs/auth';

// @TODO: this needs our window.env fix
// import { availableLanguages } from '../../../server/libs/i18n';

export default {
  components: {
    restoreModal,
    resetModal,
    deleteModal,
  },
  mixins: [notificationsMixin],
  data () {
    const dayStartOptions = [];
    for (let number = 0; number < 24; number += 1) {
      const meridian = number < 12 ? 'AM' : 'PM';
      const hour = number % 12;
      const option = {
        value: number,
        name: `${hour || 12}:00 ${meridian}`,
      };
      dayStartOptions.push(option);
    }

    return {
      SOCIAL_AUTH_NETWORKS: [],
      party: {},
      // Made available by the server as a script
      availableFormats: ['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy/MM/dd'],
      dayStartOptions,
      newDayStart: 0,
      temporaryDisplayName: '',
      usernameUpdates: { username: '' },
      emailUpdates: {},
      passwordUpdates: {},
      localAuth: {
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
      },
      displayNameIssues: [],
      usernameIssues: [],
    };
  },
  computed: {
    ...mapState({
      user: 'user.data',
      availableLanguages: 'i18n.availableLanguages',
      content: 'content',
    }),
    availableAudioThemes () {
      return ['off', ...this.content.audioThemes];
    },
    timezoneOffsetToUtc () {
      const offsetString = moment().utcOffset(getUtcOffset(this.user)).format('Z');
      return `UTC${offsetString}`;
    },
    dayStart () {
      return this.user.preferences.dayStart;
    },
    hasClass () {
      return this.$store.getters['members:hasClass'](this.user);
    },
    verifiedUsername () {
      return this.user.flags.verifiedUsername;
    },
    displayNameInvalid () {
      if (this.temporaryDisplayName.length <= 1) return false;
      return !this.displayNameValid;
    },
    displayNameValid () {
      if (this.temporaryDisplayName.length <= 1) return false;
      return this.displayNameIssues.length === 0;
    },
    displayNameCannotSubmit () {
      if (this.temporaryDisplayName.length <= 1) return true;
      return !this.displayNameValid;
    },
    usernameValid () {
      if (this.usernameUpdates.username.length <= 1) return false;
      return this.usernameIssues.length === 0;
    },
    usernameInvalid () {
      if (this.usernameUpdates.username.length <= 1) return false;
      return !this.usernameValid;
    },
    usernameCannotSubmit () {
      if (this.usernameUpdates.username.length <= 1) return true;
      return !this.usernameValid;
    },
  },
  watch: {
    usernameUpdates: {
      handler () {
        this.validateUsername(this.usernameUpdates.username);
      },
      deep: true,
    },
    temporaryDisplayName: {
      handler () {
        this.validateDisplayName(this.temporaryDisplayName);
      },
      deep: true,
    },
  },
  mounted () {
    this.SOCIAL_AUTH_NETWORKS = SUPPORTED_SOCIAL_NETWORKS;
    // @TODO: We may need to request the party here
    this.party = this.$store.state.party;
    this.newDayStart = this.user.preferences.dayStart;
    this.usernameUpdates.username = this.user.auth.local.username || null;
    this.temporaryDisplayName = this.user.profile.name;
    this.emailUpdates.newEmail = this.user.auth.local.email || null;
    this.localAuth.username = this.user.auth.local.username || null;
    this.soundIndex = 0;

    this.$store.dispatch('common:setTitle', {
      section: this.$t('settings'),
    });

    hello.init({
      facebook: process.env.FACEBOOK_KEY, // eslint-disable-line no-process-env
      google: process.env.GOOGLE_CLIENT_ID, // eslint-disable-line no-process-env
    }, {
      redirect_uri: '', // eslint-disable-line
    });

    const focusID = this.$route.query.focus;
    if (focusID !== undefined && focusID !== null) {
      this.$nextTick(() => {
        const element = document.getElementById(focusID);
        if (element !== undefined && element !== null) {
          element.focus();
        }
      });
    }
  },
  methods: {
    validateDisplayName: debounce(function checkName (displayName) {
      if (displayName.length <= 1 || displayName === this.user.profile.name) {
        this.displayNameIssues = [];
        return;
      }
      this.$store.dispatch('auth:verifyDisplayName', {
        displayName,
      }).then(res => {
        if (res.issues !== undefined) {
          this.displayNameIssues = res.issues;
        } else {
          this.displayNameIssues = [];
        }
      });
    }, 500),
    validateUsername: debounce(function checkName (username) {
      if (username.length <= 1 || username === this.user.auth.local.username) {
        this.usernameIssues = [];
        return;
      }
      this.$store.dispatch('auth:verifyUsername', {
        username,
      }).then(res => {
        if (res.issues !== undefined) {
          this.usernameIssues = res.issues;
        } else {
          this.usernameIssues = [];
        }
      });
    }, 500),
    set (preferenceType, subtype) {
      const settings = {};
      if (!subtype) {
        settings[`preferences.${preferenceType}`] = this.user.preferences[preferenceType];
      } else {
        settings[`preferences.${preferenceType}.${subtype}`] = this.user.preferences[preferenceType][subtype];
      }
      return this.$store.dispatch('user:set', settings);
    },
    hideHeader () {
      this.set('hideHeader');
      if (!this.user.preferences.hideHeader || !this.user.preferences.stickyHeader) return;
      this.user.preferences.hideHeader = false;
      this.set('stickyHeader');
    },
    toggleStickyHeader () {
      this.set('stickyHeader');
    },
    showTour  () {
      // @TODO: Do we still use this?
      // User.set({'flags.showTour':true});
      // Guide.goto('intro', 0, true);
    },
    showBailey () {
      this.$root.$emit('bv::show::modal', 'new-stuff');
    },
    hasBackupAuthOption (networkKeyToCheck) {
      if (this.user.auth.local.username) {
        return true;
      }

      return this.SOCIAL_AUTH_NETWORKS.find(network => {
        if (network.key !== networkKeyToCheck) {
          if (this.user.auth[network.key]) {
            return !!this.user.auth[network.key].id;
          }
        }

        return false;
      });
    },
    calculateNextCron () {
      let nextCron = moment().hours(this.newDayStart).minutes(0).seconds(0)
        .milliseconds(0);

      const currentHour = moment().format('H');
      if (currentHour >= this.newDayStart) {
        nextCron = nextCron.add(1, 'day');
      }

      return nextCron.format(`${this.user.preferences.dateFormat.toUpperCase()} @ h:mm a`);
    },
    openDayStartModal () {
      const nextCron = this.calculateNextCron();
      // @TODO: Add generic modal
      if (!window.confirm(this.$t('sureChangeCustomDayStartTime', { time: nextCron }))) return; // eslint-disable-line no-alert
      this.saveDayStart();
      // $rootScope.openModal('change-day-start', { scope: $scope });
    },
    async saveDayStart () {
      this.user.preferences.dayStart = this.newDayStart;
      await axios.post('/api/v4/user/custom-day-start', {
        dayStart: this.newDayStart,
      });
      // @TODO
      // Notification.text(response.data.data.message);
    },
    async changeLanguage (e) {
      const newLang = e.target.value;
      this.user.preferences.language = newLang;
      await this.set('language');
      setTimeout(() => window.location.reload(true));
    },
    async changeUser (attribute, updates) {
      await axios.put(`/api/v4/user/auth/update-${attribute}`, updates);
      if (attribute === 'username') {
        this.user.auth.local.username = updates[attribute];
        this.localAuth.username = this.user.auth.local.username;
        this.user.flags.verifiedUsername = true;
      } else if (attribute === 'email') {
        this.user.auth.local.email = updates.newEmail;
        window.alert(this.$t('emailSuccess')); // eslint-disable-line no-alert
      }
    },
    async changeDisplayName (newName) {
      await axios.put('/api/v4/user/', { 'profile.name': newName });
      window.alert(this.$t('displayNameSuccess')); // eslint-disable-line no-alert
      this.user.profile.name = newName;
      this.temporaryDisplayName = newName;
    },
    openRestoreModal () {
      this.$root.$emit('bv::show::modal', 'restore');
    },
    openResetModal () {
      this.$root.$emit('bv::show::modal', 'reset');
    },
    openDeleteModal () {
      this.$root.$emit('bv::show::modal', 'delete');
    },
    async deleteSocialAuth (network) {
      await axios.delete(`/api/v4/user/auth/social/${network.key}`);
      this.user.auth[network.key] = {};
      this.text(this.$t('detachedSocial', { network: network.name }));
    },
    async socialAuth (network) {
      if (network === 'apple') {
        window.location.href = buildAppleAuthUrl();
      } else {
        const auth = await hello(network).login({ scope: 'email' });

        await this.$store.dispatch('auth:socialAuth', {
          auth,
        });

        window.location.href = '/';
      }
    },
    async changeClassForUser (confirmationNeeded) {
      if (confirmationNeeded && !window.confirm(this.$t('changeClassConfirmCost'))) return; // eslint-disable-line no-alert
      try {
        changeClass(this.user);
        await axios.post('/api/v4/user/change-class');
      } catch (e) {
        window.alert(e.message); // eslint-disable-line no-alert
      }
    },
    async addLocalAuth () {
      await axios.post('/api/v4/user/auth/local/register', this.localAuth);
      window.alert(this.$t('addedLocalAuth')); // eslint-disable-line no-alert
    },
    restoreEmptyUsername () {
      if (this.usernameUpdates.username.length < 1) {
        this.usernameUpdates.username = this.user.auth.local.username;
      }
    },
    changeAudioTheme () {
      this.soundIndex = 0;
      this.set('sound');
    },
    playAudio () {
      this.$root.$emit('playSound', sounds[this.soundIndex]);
      this.soundIndex = (this.soundIndex + 1) % sounds.length;
    },
  },
};
</script>
