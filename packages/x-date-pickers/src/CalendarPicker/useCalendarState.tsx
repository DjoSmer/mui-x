import * as React from 'react';
import { SlideDirection } from './PickersSlideTransition';
import { validateDate } from '../internals/hooks/validation/useDateValidation';
import { useUtils, useNow } from '../internals/hooks/useUtils';
import { MuiPickersAdapter } from '../internals/models';
import type { CalendarPickerProps } from './CalendarPicker';

interface CalendarState<TDate> {
  currentMonth: TDate;
  focusedDay: TDate | null;
  isMonthSwitchingAnimating: boolean;
  slideDirection: SlideDirection;
}

type ReducerAction<TType, TAdditional = {}> = { type: TType } & TAdditional;

interface ChangeMonthPayload<TDate> {
  direction: SlideDirection;
  newMonth: TDate;
}

export const createCalendarStateReducer =
  <TDate extends unknown>(
    reduceAnimations: boolean,
    disableSwitchToMonthOnDayFocus: boolean,
    utils: MuiPickersAdapter<TDate>,
  ) =>
  (
    state: CalendarState<TDate>,
    action:
      | ReducerAction<'finishMonthSwitchingAnimation'>
      | ReducerAction<'changeMonth', ChangeMonthPayload<TDate>>
      | ReducerAction<'changeFocusedDay', { focusedDay: TDate }>,
  ): CalendarState<TDate> => {
    switch (action.type) {
      case 'changeMonth':
        return {
          ...state,
          slideDirection: action.direction,
          currentMonth: action.newMonth,
          isMonthSwitchingAnimating: !reduceAnimations,
        };

      case 'finishMonthSwitchingAnimation':
        return {
          ...state,
          isMonthSwitchingAnimating: false,
        };

      case 'changeFocusedDay': {
        if (state.focusedDay !== null && utils.isSameDay(action.focusedDay, state.focusedDay)) {
          return state;
        }

        const needMonthSwitch =
          Boolean(action.focusedDay) &&
          !disableSwitchToMonthOnDayFocus &&
          !utils.isSameMonth(state.currentMonth, action.focusedDay);

        return {
          ...state,
          focusedDay: action.focusedDay,
          isMonthSwitchingAnimating: needMonthSwitch && !reduceAnimations,
          currentMonth: needMonthSwitch
            ? utils.startOfMonth(action.focusedDay)
            : state.currentMonth,
          slideDirection: utils.isAfterDay(action.focusedDay, state.currentMonth)
            ? 'left'
            : 'right',
        };
      }

      default:
        throw new Error('missing support');
    }
  };

interface CalendarStateInput<TDate>
  extends Pick<
    CalendarPickerProps<TDate>,
    | 'date'
    | 'defaultCalendarMonth'
    | 'disableFuture'
    | 'disablePast'
    | 'minDate'
    | 'maxDate'
    | 'onMonthChange'
    | 'reduceAnimations'
    | 'shouldDisableDate'
  > {
  disableSwitchToMonthOnDayFocus?: boolean;
}

export const useCalendarState = <TDate extends unknown>({
  date,
  defaultCalendarMonth,
  disableFuture,
  disablePast,
  disableSwitchToMonthOnDayFocus = false,
  maxDate,
  minDate,
  onMonthChange,
  reduceAnimations,
  shouldDisableDate,
}: CalendarStateInput<TDate>) => {
  const now = useNow<TDate>();
  const utils = useUtils<TDate>();

  const reducerFn = React.useRef(
    createCalendarStateReducer<TDate>(
      Boolean(reduceAnimations),
      disableSwitchToMonthOnDayFocus,
      utils,
    ),
  ).current;

  const [calendarState, dispatch] = React.useReducer(reducerFn, {
    isMonthSwitchingAnimating: false,
    focusedDay: date || now,
    currentMonth: utils.startOfMonth(date ?? defaultCalendarMonth ?? now),
    slideDirection: 'left',
  });

  const handleChangeMonth = React.useCallback(
    (payload: ChangeMonthPayload<TDate>) => {
      dispatch({
        type: 'changeMonth',
        ...payload,
      });

      if (onMonthChange) {
        onMonthChange(payload.newMonth);
      }
    },
    [onMonthChange],
  );

  const changeMonth = React.useCallback(
    (newDate: TDate) => {
      const newDateRequested = newDate ?? now;
      if (utils.isSameMonth(newDateRequested, calendarState.currentMonth)) {
        return;
      }

      handleChangeMonth({
        newMonth: utils.startOfMonth(newDateRequested),
        direction: utils.isAfterDay(newDateRequested, calendarState.currentMonth)
          ? 'left'
          : 'right',
      });
    },
    [calendarState.currentMonth, handleChangeMonth, now, utils],
  );

  const isDateDisabled = React.useCallback(
    (day: TDate | null) =>
      validateDate(utils, day, {
        disablePast,
        disableFuture,
        minDate,
        maxDate,
        shouldDisableDate,
      }) !== null,
    [disableFuture, disablePast, maxDate, minDate, shouldDisableDate, utils],
  );

  const onMonthSwitchingAnimationEnd = React.useCallback(() => {
    dispatch({ type: 'finishMonthSwitchingAnimation' });
  }, []);

  const changeFocusedDay = React.useCallback(
    (newFocusedDate: TDate) => {
      if (!isDateDisabled(newFocusedDate)) {
        dispatch({ type: 'changeFocusedDay', focusedDay: newFocusedDate });
      }
    },
    [isDateDisabled],
  );

  return {
    calendarState,
    changeMonth,
    changeFocusedDay,
    isDateDisabled,
    onMonthSwitchingAnimationEnd,
    handleChangeMonth,
  };
};
