import React from 'react';
import { Resizable, ResizeCallbackData } from 'react-resizable';

interface ResizableTitleProps {
  onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  children: React.ReactNode;
  className?: string;
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, minWidth = 50, maxWidth = 500, children, className = '', ...restProps } = props;

  if (!width) {
    return <th {...restProps}>{children}</th>;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
      minConstraints={[minWidth, 0]}
      maxConstraints={[maxWidth, 0]}
    >
      <th {...restProps} className={className}>
        {children}
      </th>
    </Resizable>
  );
};

export default ResizableTitle;