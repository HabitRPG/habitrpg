multi<template>
  <div>
    <b-dropdown
      ref="dropdown"
      class="inline-dropdown select-multi"
      :toggle-class="isOpened ? 'active' : null"
      @show="wasOpened()"
      @hide="hideCallback($event)"
      @toggle="openOrClose($event)"
    >
      <b-dropdown-header>
        <div class="mb-2">
          <b-form-input
            v-model="search"
            type="text"
            :placeholder="searchPlaceholder"
            @keyup.enter="handleSubmit"
          />
        </div>

        <multi-list
          v-if="selectedItems.length > 0"
          :add-new="addNew"
          :pill-invert="pillInvert"
          :items="selectedItemsAsObjects"
          :max-items="0"
          @remove-item="removeItem($event)"
        />
      </b-dropdown-header>
      <template v-slot:button-content>
        <multi-list
          :items="selectedItemsAsObjects"
          :add-new="addNew"
          :pill-invert="pillInvert"
          :empty-message="emptyMessage"
          @remove-item="removeItem($event)"
        />
      </template>
      <div
        v-if="addNew || availableToSelect.length > 0"
        :class="{
          'item-group': true,
          'add-new': availableToSelect.length === 0 && search !== '',
          'scroll': availableToSelect.length > 5
        }"
      >
        <b-dropdown-item-button
          v-for="item in availableToSelect"
          :key="item.id"
          class="ignore-hide multi-item"
          :class="{ 'none': item.id === 'none', selectListItem: true }"
          @click="selectItem(item)"
        >
          <div
            v-markdown="item.name"
            class="label"
          ></div>
          <div
            v-if="item.challenge"
            class="addl-text"
          >
            {{ $t('challenge') }}
          </div>
          <div
            v-else-if="item.addlText"
            class="addl-text"
          >
            {{ item.addlText }}
          </div>
        </b-dropdown-item-button>

        <div
          v-if="addNew"
          class="hint"
        >
          {{ $t('pressEnterToAddTag', { tagName: search }) }}
        </div>
      </div>
    </b-dropdown>
  </div>
</template>

<style lang="scss">
@import '~@/assets/scss/colors.scss';

$itemHeight: 2rem;

.select-multi {
  .dropdown-toggle {
    padding-left: 0.75rem;
  }

  .dropdown-header {
    background-color: $gray-700;
    padding-bottom: 0;
    min-height: 3rem;
  }

  .dropdown-item, .dropdown-header {
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }

  .none {
    cursor: default;
    pointer-events: none;
  }

  .multi-item button {
    height: $itemHeight;
    display: flex;

    .label {
      height: 1.5rem;
      font-size: 14px;
      line-height: 1.71;
      flex: 1;
    }

    .addl-text {
      height: 1rem;
      font-size: 12px;
      font-weight: normal;
      font-stretch: normal;
      font-style: normal;
      line-height: 1.33;
      letter-spacing: normal;
      text-align: right;
      color: $gray-100;
      align-self: center;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
      margin-right: 0.25rem;
    }

    &:hover {
      .addl-text {
        color: $purple-300;
      }
    }
  }

  .item-group {
    max-height: #{5*$itemHeight};

    &.add-new {
      height: 30px;

      .hint {
        display: block;
      }
    }
    &.scroll {
      overflow-y: scroll;
    }
  }

  .hint {
    display: none;
    height: 2rem;
    font-size: 12px;
    font-weight: normal;
    font-stretch: normal;
    font-style: normal;
    line-height: 1.33;
    letter-spacing: normal;
    color: $gray-100;

    margin-left: 0.75rem;
    margin-top: 0.5rem;
  }
}

</style>

<script>
import Vue from 'vue';
import MultiList from '@/components/tasks/modal-controls/multiList';
import markdownDirective from '@/directives/markdown';

export default {
  directives: {
    markdown: markdownDirective,
  },
  components: {
    MultiList,
  },
  props: {
    addNew: {
      type: Boolean,
      default: false,
    },
    allItems: {
      type: Array,
    },
    emptyMessage: {
      type: String,
    },
    pillInvert: {
      type: Boolean,
      default: false,
    },
    searchPlaceholder: {
      type: String,
    },
    selectedItems: {
      type: Array,
    },
  },
  data () {
    return {
      isOpened: false,
      wasTagAdded: false,
      selected: this.selectedItems,
      search: '',
    };
  },
  computed: {
    selectedItemsIdList () {
      return this.selectedItems
        ? this.selectedItems.map(t => t)
        : [];
    },
    allItemsMap () {
      const obj = {};
      this.allItems.forEach(t => {
        obj[t.id] = t;
      });
      return obj;
    },
    selectedItemsAsObjects () {
      return this.selectedItems.map(t => this.allItemsMap[t]);
    },
    availableToSelect () {
      const availableItems = this.allItems.filter(t => !this.selectedItemsIdList.includes(t.id));

      const searchString = this.search.toLowerCase();

      const filteredItems = availableItems.filter(i => i.name.toLowerCase().includes(searchString));

      return filteredItems;
    },
  },
  watch: {
    selected () {
      this.$emit('changed', this.selected);
    },
  },
  created () {
    document.addEventListener('keyup', this.handleEsc);
  },
  beforeDestroy () {
    document.removeEventListener('keyup', this.handleEsc);
  },
  mounted () {
    this.$refs.dropdown.clickOutHandler = () => {
      this.closeSelectPopup();
    };
  },
  methods: {
    closeSelectPopup () {
      this.preventHide = false;
      this.isOpened = false;
      if (!this.wasTagAdded) {
        Vue.nextTick(() => {
          this.$refs.dropdown.hide();
        });
      }
      this.wasTagAdded = false;
    },
    openOrClose ($event) {
      if (this.isOpened) {
        this.closeSelectPopup();
        $event.preventDefault();
      }
    },
    closeIfOpen () {
      this.closeSelectPopup();
    },
    selectItem (item) {
      this.selectedItems.push(item.id);
      this.$emit('toggle', item.id);
      this.preventHide = true;
      this.wasTagAdded = true;
    },
    removeItem ($event) {
      const foundIndex = this.selectedItems.findIndex(t => t === $event);
      this.selectedItems.splice(foundIndex, 1);
      this.$emit('toggle', $event);
    },
    hideCallback ($event) {
      if (this.preventHide) {
        $event.preventDefault();
        return;
      }
      this.isOpened = false;
    },
    wasOpened () {
      this.isOpened = true;
      this.preventHide = false;
    },
    handleEsc (e) {
      if (e.keyCode === 27) {
        this.closeSelectPopup();
      }
    },
    handleSubmit () {
      if (!this.addNew) return;
      const { search } = this;
      this.$emit('addNew', search);

      this.search = '';
    },
  },
};
</script>
