import classcat from 'classcat';
import { format } from 'date-fns';
import invariant from 'invariant';
import Resizable, { ResizeCallback } from 're-resizable';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import Draggable, { DraggableEventHandler } from 'react-draggable';
import useMousetrap from '../hooks/useMousetrap';
import { CellInfo } from '../types';
import { ScheduleProps } from './Schedule';
import { getTextForDateRange } from '../utils/getTextForDateRange';
// @ts-ignore
import VisuallyHidden from '@reach/visually-hidden';

export const RangeBox = React.memo(function RangeBox({
  classes,
  grid,
  isBeingEdited,
  rangeIndex,
  cellIndex,
  cellArray,
  cell,
  className,
  onChange,
  cellInfoToDateRange,
  isResizable,
  isDeletable,
  moveAxis,
  onActiveChange
}: ScheduleProps & {
  cellIndex: number;
  cellArray: CellInfo[];
  className?: string;
  rangeIndex: number;
  cell: CellInfo;
}) {
  const ref = useRef(null);
  const [modifiedCell, setModifiedCell] = useState(cell);
  const originalRect = useMemo(() => grid.getRectFromCell(cell), [cell, grid]);
  const rect = useMemo(() => grid.getRectFromCell(modifiedCell), [
    modifiedCell,
    grid
  ]);

  useEffect(() => {
    setModifiedCell(cell);
  }, [cell]);

  const modifiedDateRange = useMemo(() => cellInfoToDateRange(modifiedCell), [
    modifiedCell
  ]);

  const handleDelete = useCallback(() => {
    if (!isDeletable) {
      return;
    }

    onChange && onChange(undefined, rangeIndex);
  }, [ref.current, onChange, isDeletable, rangeIndex]);

  useMousetrap('del', handleDelete, ref.current);

  const { top, left, width, height } = rect;

  const isStart = cellIndex === 0;
  const isEnd = cellIndex === cellArray.length - 1;

  const handleStop = useCallback(() => {
    onChange && onChange(cellInfoToDateRange(modifiedCell), rangeIndex);
  }, [modifiedCell, rangeIndex, cellInfoToDateRange, onChange]);

  useMousetrap(
    'up',
    () => {
      if (moveAxis === 'none' || moveAxis === 'x') {
        return;
      }

      if (modifiedCell.startY === 0) {
        return;
      }

      const newCell = {
        ...modifiedCell,
        startY: modifiedCell.startY - 1,
        endY: modifiedCell.endY - 1
      };

      onChange && onChange(cellInfoToDateRange(newCell), rangeIndex);
    },
    ref.current
  );

  useMousetrap(
    'down',
    () => {
      if (moveAxis === 'none' || moveAxis === 'x') {
        return;
      }

      if (modifiedCell.endY === grid.numVerticalCells - 1) {
        return;
      }

      const newCell = {
        ...modifiedCell,
        startY: modifiedCell.startY + 1,
        endY: modifiedCell.endY + 1
      };

      onChange && onChange(cellInfoToDateRange(newCell), rangeIndex);
    },
    ref.current
  );

  const handleDrag: DraggableEventHandler = useCallback(
    (event, { y, x }) => {
      if (moveAxis === 'none') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const newRect = {
        ...rect
      };

      if (moveAxis === 'both' || moveAxis === 'y') {
        const _startY = y;
        const _endY = _startY + rect.height;
        const newTop = Math.min(_startY, _endY);
        const newBottom = newTop + rect.height;
        newRect.bottom = newBottom;
        newRect.top = newTop;
      }

      if (moveAxis === 'both' || moveAxis === 'x') {
        const _startX = x;
        const _endX = _startX + rect.width;
        const newLeft = Math.min(_startX, _endX);
        const newRight = newLeft + rect.width;
        newRect.right = newRight;
        newRect.left = newLeft;
      }

      const { startY, startX } = grid.getCellFromRect(newRect);

      const newCell = {
        ...cell,
        startX,
        endX: startX + cell.spanX - 1,
        startY,
        endY: startY + cell.spanY - 1
      };

      invariant(
        newCell.spanY === cell.spanY && newCell.spanX === cell.spanX,
        `Expected the dragged time cell to have the same dimensions)`
      );

      setModifiedCell(newCell);
    },
    [grid, rect, moveAxis, setModifiedCell]
  );

  const handleResize: ResizeCallback = useCallback(
    (event, direction, _ref, delta) => {
      if (!isResizable) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (delta.height === 0) {
        return;
      }

      const newSize = {
        height: delta.height + rect.height,
        width: delta.width + rect.width + 20
      };

      const newRect = {
        ...originalRect,
        ...newSize
      };

      if (direction.includes('top')) {
        newRect.top -= delta.height;
      } else if (direction.includes('bottom')) {
        newRect.bottom += delta.height;
      }

      const { spanY, startY, endY } = grid.getCellFromRect(newRect);
      const newCell = {
        ...cell,
        spanY,
        startY,
        endY
      };

      setModifiedCell(newCell);
    },
    [grid, rect, isResizable, setModifiedCell, originalRect]
  );

  const handleOnFocus = useCallback(() => {
    onActiveChange && onActiveChange(rangeIndex, cellIndex);
  }, [onActiveChange]);

  const handleOnBlur = useCallback(() => {
    onActiveChange && onActiveChange(rangeIndex, null);
  }, [onActiveChange]);

  return (
    <Draggable
      axis={moveAxis}
      bounds={{
        top: 0,
        bottom: grid.totalHeight - height,
        left: 0,
        right: grid.totalWidth
      }}
      position={{ x: left, y: top }}
      onDrag={handleDrag}
      onStop={handleStop}
      cancel={`.${classes.handle}`}
    >
      <button
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        className={classcat([
          classes['event'],
          classes['button-reset'],
          classes['range-box'],
          className,
          {
            [classes['is-draggable']]: moveAxis !== 'none',
            [classes['is-being-edited']]: isBeingEdited && isBeingEdited(cell)
          }
        ])}
        ref={ref}
        tabIndex={0}
        style={{ width: width - 20, height }}
      >
        <Resizable
          size={{ ...originalRect, width: originalRect.width - 20 }}
          onResize={handleResize}
          onResizeStop={handleStop}
          handleWrapperClass={classes['handle-wrapper']}
          enable={
            isResizable
              ? {
                  top: true,
                  bottom: true
                }
              : {}
          }
          handleClasses={{
            bottom: classcat([classes['handle'], classes.bottom]),
            bottomLeft: classcat([classes['handle'], classes['bottom-left']]),
            bottomRight: classcat([classes['handle'], classes['bottom-right']]),
            left: classcat([classes['handle'], classes.left]),
            right: classcat([classes['handle'], classes.right]),
            top: classcat([classes['handle'], classes.top]),
            topLeft: classcat([classes['handle'], classes['top-left']]),
            topRight: classcat([classes['handle'], classes['top-right']])
          }}
        >
          <div
            style={{ width: width - 20, height }}
            className={classes['event-content']}
          >
            <VisuallyHidden>
              {getTextForDateRange(modifiedDateRange)}
            </VisuallyHidden>
            <span aria-hidden className={classes['start']}>
              {isStart && format(modifiedDateRange[0], 'h:mma')}
            </span>
            <span aria-hidden className={classes['end']}>
              {isEnd && format(modifiedDateRange[1], 'h:mma')}
            </span>
          </div>
        </Resizable>
      </button>
    </Draggable>
  );
});
