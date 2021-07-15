<template>
  <div
    class="notification callout pt-0"
    :class="classes"
    @click="handleOnClick()"
  >
    <div
      v-if="notification.type === 'error'"
      class="row"
    >
      <div class="text col-12">
        <div v-html="notification.text"></div>
      </div>
    </div>
    <div
      v-if="notification.type === 'streak'"
      class="row"
    >
      <div class="text col-7 offset-1">
        <div>{{ message }}</div>
      </div>
      <div class="icon col-4">
        <div
          class="svg-icon"
          v-html="icons.gold"
        ></div>
        <div v-html="notification.text"></div>
      </div>
    </div>
    <div
      v-if="['hp', 'gp', 'xp', 'mp'].indexOf(notification.type) !== -1"
      class="row"
    >
      <div class="text col-7 offset-1">
        <div>{{ message }}</div>
      </div>
      <div class="icon col-4 d-flex align-items-center">
        <div
          v-if="notification.type === 'hp'"
          class="svg-icon"
          v-html="icons.health"
        ></div>
        <div
          v-if="notification.type === 'gp'"
          class="svg-icon"
          v-html="icons.gold"
        ></div>
        <div
          v-if="notification.type === 'xp'"
          class="svg-icon"
          v-html="icons.star"
        ></div>
        <div
          v-if="notification.type === 'mp'"
          class="svg-icon"
          v-html="icons.mana"
        ></div>
        <div v-html="notification.text"></div>
      </div>
    </div>
    <div
      v-if="notification.type === 'damage'"
      class="row"
    >
      <div class="text col-7 offset-1">
        <div>{{ message }}</div>
      </div>
      <div class="icon col-4">
        <div
          class="svg-icon"
          v-html="icons.sword"
        ></div>
        <div v-html="notification.text"></div>
      </div>
    </div>
    <div
      v-if="['info', 'success', 'crit', 'lvl'].indexOf(notification.type) !== -1"
      class="row"
    >
      <div class="text col-12">
        <div v-html="notification.text"></div>
      </div>
    </div>
    <div
      v-if="notification.type === 'drop'"
      class="row"
    >
      <div class="col-3">
        <div class="icon-item">
          <div :class="notification.icon"></div>
        </div>
      </div>
      <div class="text col-8">
        <div v-html="notification.text"></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@import '~@/assets/scss/colors.scss';

  .notification {
    border-radius: 30px;
    background-color: #24cc8f;
    box-shadow: 0 2px 2px 0 rgba(26, 24, 29, 0.16), 0 1px 4px 0 rgba(26, 24, 29, 0.12);
    color: white;
    width: 300px;
    margin-left: 1em;
    margin-bottom: 1em;

    transition: opacity .5s, top .5s;

    .row {
      margin: 0 !important;
    }
  }

  .info {
    background-color: #46a7d9;
    padding-top: .5em;
  }

  .error {
    background-color: #f74e52;
    border-radius: 60px;
    padding: 10px 5px;
    color: #fff;
  }

  .negative {
    background-color: #f74e52;
  }

  .text {
    text-align: center;
    padding: .5em 1.5em;
  }

  .svg-icon {
    width: 20px;
    height: 20px;
    margin-right: .5em;
  }

  .hp .icon {
    color: #f74e52;
  }

  .mp .icon {
    color: #2995cd;
  }

  .damage .icon {
    color: $gray-100;
  }

  .icon {
    background: #fff;
    color: #ffa623;
    border-radius: 0 1000px 1000px 0;
    padding: .5em;

    div {
      display: inline-block;
      vertical-align: bottom;
    }
  }

  .drop {
    background-color: #4e4a57;
  }

  .icon-item {
    width: 64px;
    height: 64px;
    background-color: #ffffff;
    box-shadow: 0 2px 2px 0 rgba(26, 24, 29, 0.16), 0 1px 4px 0 rgba(26, 24, 29, 0.12);
    border-radius: 50%;
  }
</style>

<script>
import health from '@/assets/svg/health.svg';
import gold from '@/assets/svg/gold.svg';
import star from '@/assets/svg/star.svg';
import mana from '@/assets/svg/mana.svg';
import sword from '@/assets/svg/sword.svg';

export default {
  props: ['notification', 'visibleAmount'],
  data () {
    return {
      icons: Object.freeze({
        health,
        gold,
        star,
        mana,
        sword,
      }),
    };
  },
  computed: {
    message () {
      if (this.notification.flavorMessage) {
        return this.notification.flavorMessage;
      }
      let localeKey = this.negative === 'negative' ? 'lost' : 'gained';
      if (this.notification.type === 'hp') localeKey += 'Health';
      if (this.notification.type === 'mp') localeKey += 'Mana';
      if (this.notification.type === 'xp') localeKey += 'Experience';
      if (this.notification.type === 'gp') localeKey += 'Gold';
      if (this.notification.type === 'streak') localeKey = 'streakCoins';
      if (this.notification.type === 'damage') localeKey = 'bossDamage';
      return this.$t(localeKey);
      // This requires eight translatable strings, but that gives the
      // translators the most flexibility for matching gender/number
      // and for using idioms for lost/spent/used/gained.
    },
    negative () {
      return this.notification.sign === '-' ? 'negative' : 'positive';
    },
    classes () {
      return `${this.notification.type} ${this.negative}`;
    },
  },
  methods: {
    handleOnClick () {
      if (typeof this.notification.onClick === 'function') {
        this.notification.onClick();
      }
      this.$emit('clicked');
      this.show = false;
    },
  },
};
</script>
