// TODO what can be moved to /website/server?
/*
  ------------------------------------------------------
  Cron and time / day functions
  ------------------------------------------------------
 */
import defaults from 'lodash/defaults';
import invert from 'lodash/invert';
import moment from 'moment';
import 'moment-recur';

export const DAY_MAPPING = {
  0: 'su',
  1: 'm',
  2: 't',
  3: 'w',
  4: 'th',
  5: 'f',
  6: 's',
};

export const DAY_MAPPING_STRING_TO_NUMBER = invert(DAY_MAPPING);

/*
  Each time we perform date maths (cron, task-due-days, etc), we need to consider user preferences.
  Specifically {dayStart} (custom day start) and {timezoneOffset}. This function sanitizes / defaults those values.
  {now} is also passed in for various purposes, one example being the test scripts scripts testing different "now" times.
 */

function sanitizeOptions (o) {
  let ref = Number(o.dayStart || 0);
  let dayStart = !Number.isNaN(ref) && ref >= 0 && ref <= 24 ? ref : 0;

  let timezoneOffset;
  let timezoneOffsetDefault = Number(moment().zone());

  if (isFinite(o.timezoneOffsetOverride)) {
    timezoneOffset = Number(o.timezoneOffsetOverride);
  } else if (Number.isFinite(o.timezoneOffset)) {
    timezoneOffset = Number(o.timezoneOffset);
  } else {
    timezoneOffset = timezoneOffsetDefault;
  }
  if (timezoneOffset > 720 || timezoneOffset < -840) {
    // timezones range from -12 (offset +720) to +14 (offset -840)
    timezoneOffset = timezoneOffsetDefault;
  }

  let now = o.now ? moment(o.now).zone(timezoneOffset) : moment().zone(timezoneOffset);

  // return a new object, we don't want to add "now" to user object
  return {
    dayStart,
    timezoneOffset,
    now,
  };
}

export function startOfWeek (options = {}) {
  let o = sanitizeOptions(options);

  return moment(o.now).startOf('week');
}

/*
  This is designed for use with any date that has an important time portion (e.g., when comparing the current date-time with the previous cron's date-time for determing if cron should run now).
  It changes the time portion of the date-time to be the Custom Day Start hour, so that the date-time is now the user's correct start of day.
  It SUBTRACTS a day if the date-time's original hour is before CDS (e.g., if your CDS is 5am and it's currently 4am, it's still the previous day).
  This is NOT suitable for manipulating any dates that are displayed to the user as a date with no time portion, such as a Daily's Start Dates (e.g., a Start Date of today shows only the date, so it should be considered to be today even if the hidden time portion is before CDS).
 */

export function startOfDay (options = {}) {
  let o = sanitizeOptions(options);
  let dayStart = moment(o.now).startOf('day').add({ hours: o.dayStart });

  if (moment(o.now).hour() < o.dayStart) {
    dayStart.subtract({ days: 1 });
  }
  return dayStart;
}

/*
  Absolute diff from "yesterday" till now
 */

export function daysSince (yesterday, options = {}) {
  let o = sanitizeOptions(options);

  return startOfDay(defaults({ now: o.now }, o)).diff(startOfDay(defaults({ now: yesterday }, o)), 'days');
}

/*
  Should the user do this task on this date, given the task's repeat options and user.preferences.dayStart?
 */

export function shouldDo (day, dailyTask, options = {}) {
  if (dailyTask.type !== 'daily' || dailyTask.everyX > 9999) {
    return false;
  }
  let o = sanitizeOptions(options);
  let startOfDayWithCDSTime = startOfDay(defaults({ now: day }, o));
  // The time portion of the Start Date is never visible to or modifiable by the user so we must ignore it.
  // Therefore, we must also ignore the time portion of the user's day start (startOfDayWithCDSTime), otherwise the date comparison will be wrong for some times.
  // NB: The user's day start date has already been converted to the PREVIOUS day's date if the time portion was before CDS.

  let startDate = moment(dailyTask.startDate).zone(o.timezoneOffset).startOf('day');

  if (startDate > startOfDayWithCDSTime.startOf('day') && !options.nextDue) {
    return false; // Daily starts in the future
  }

  let daysOfTheWeek = [];
  let schedule = [];

  if (dailyTask.repeat) {
    for (let [repeatDay, active] of Object.entries(dailyTask.repeat)) {
      if (!isFinite(DAY_MAPPING_STRING_TO_NUMBER[repeatDay])) continue; // eslint-disable-line no-continue
      if (active) daysOfTheWeek.push(parseInt(DAY_MAPPING_STRING_TO_NUMBER[repeatDay], 10));
    }
    daysOfTheWeek.sort();
  }

  if (dailyTask.frequency === 'daily') {
    if (!dailyTask.everyX) return false; // error condition

    let i = 1;
    while (schedule.length < 6) {
      let calcDate = moment(startDate).add(dailyTask.everyX * i, 'days');
      if (calcDate >= startOfDayWithCDSTime) schedule.push(calcDate);
      i++;
    }

    if (options.nextDue) {
      return schedule;
    }

    // true if current day = (task start date or first calculated due date)
    return startOfDayWithCDSTime.isSame(moment(startDate), 'day') || startOfDayWithCDSTime.isSame(schedule[0], 'day');
  } else if (dailyTask.frequency === 'weekly') {
    if (daysOfTheWeek.length === 0) return false;

    // weekly multiple starts at 0 for current week
    let i = 0;
    while (schedule.length < 6) {
      for (let j = 0; j < daysOfTheWeek.length && schedule.length < 6; j++) {
        let calcDate = moment(startDate).day(daysOfTheWeek[j]).add(dailyTask.everyX * i, 'weeks');
        if (calcDate >= startOfDayWithCDSTime) schedule.push(calcDate);
      }
      i++;
    }

    if (options.nextDue) {
      return schedule;
    }
    // true if current day = (task start date or first calculated due date)
    return startOfDayWithCDSTime.isSame(moment(startDate), 'day') || startOfDayWithCDSTime.isSame(schedule[0], 'day');
  } else if (dailyTask.frequency === 'monthly') {
    if (dailyTask.weeksOfMonth && dailyTask.weeksOfMonth.length > 0) {
      let differenceInMonths = moment(startOfDayWithCDSTime).month() - moment(startDate).month();
      let matchEveryX = differenceInMonths % dailyTask.everyX === 0;
      schedule = moment(startDate).recur().every(daysOfTheWeek).daysOfWeek().every(dailyTask.weeksOfMonth).weeksOfMonthByDay();

      if (options.nextDue) {
        let dates = schedule.fromDate(startOfDayWithCDSTime).next(6);
        let filterDates = dates.filter((momentDate) => {
          let monthDiff = momentDate.month() - moment(startDate).month();
          let matchX = monthDiff % dailyTask.everyX === 0;
          return matchX;
        });
        return filterDates;
      }
      return schedule.matches(startOfDayWithCDSTime) && matchEveryX;
    } else if (dailyTask.daysOfMonth && dailyTask.daysOfMonth.length > 0) {
      let i = 0;
      while (schedule.length < 6) {
        let calcDate = moment(startDate).add(dailyTask.everyX * i, 'months');
        if (calcDate >= startOfDayWithCDSTime) schedule.push(calcDate);
        i++;
      }

      if (options.nextDue) {
        return schedule;
      }
      // true if current day = (task start date or first calculated due date)
      return startOfDayWithCDSTime.isSame(moment(startDate), 'day') || startOfDayWithCDSTime.isSame(schedule[0], 'day');
    }

    return false;
  } else if (dailyTask.frequency === 'yearly') {
    let i = 1;
    while (schedule.length < 6) {
      let calcDate = moment(startDate).add(dailyTask.everyX * i, 'years');
      if (calcDate >= startOfDayWithCDSTime) schedule.push(calcDate);
      i++;
    }

    if (options.nextDue) {
      return schedule;
    }

    // true if current day = (task start date or first calculated due date)
    return startOfDayWithCDSTime.isSame(moment(startDate), 'day') || startOfDayWithCDSTime.isSame(schedule[0], 'day');
  }

  return false;
}
