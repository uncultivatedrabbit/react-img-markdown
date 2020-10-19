
import React, { useEffect, useRef, useState } from 'react'
import { svgAsDataUri } from 'save-svg-as-png'
import { v1 } from 'uuid'
import useSvgMousePosition from '../hooks/useSvgMousePosition'
import SelectionBox from './SelectionBox'
import PropTypes from 'prop-types'


const ImgMarkup = ({ children, imgSrc, imgStyles, onSave }) => {
  const svgRef = useRef()
  const imgRef = useRef()
  const { x, y, pageX, pageY } = useSvgMousePosition(svgRef)
  
  const [activePathId, setActivePathId] = useState(null)
  const [activityState, setActivityState] = useState('create')
  const [paths, setPaths] = useState({ pathOrder: [] })
  const [shiftActive, setShiftActive] = useState(false)

  // active path stuff
  const [activeColor, setActiveColor] = useState('red')
  const [activeType, setActiveType] = useState('rect')
  const [activeStrokeWidth, setActiveStrokeWidth] = useState(2)
  const [activeFontSize, setActiveFontSize] = useState(20)


  // this is just for text, other path dragging is inside of SelectionBox
  const [textDragRelationaryPositions, setTextDragRelationaryPositions] = useState({
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
  })
  const [isDraggingText, setIsDragginText] = useState(false)


  const handleMouseDown = (e) => {
    const targetName = e.target.attributes?.name?.value
    const mouseDownOnPath = targetName && paths.hasOwnProperty(targetName)

    // setActivePathId(null)
    // setActivityState('create')

    if (activityState === 'create' && !mouseDownOnPath) {
      const id = v1()

      setActivityState('drag')
      setActivePathId(id)
      setPaths({
        ...paths,
        pathOrder: [...paths.pathOrder, id],
        [id]: {
          type: activeType,
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          x1: x,
          y1: y,
          x2: x,
          y2: y,
          pageX1: pageX,
          pageY1: pageY,
          pageX2: pageX,
          pageY2: pageY,
          id,
          textContent: 'default text',
          fontSize: activeFontSize,
        }
      })
    } else if (activityState === 'create' && mouseDownOnPath) {
      e.preventDefault()
      setActivePathId(targetName)
      setActivityState('selected')
    } else if (activityState === 'selected') {
      setActivityState('create')
    }
  }

  const handleMouseUp = () => {
    if (activityState === 'drag') {
      setActivityState('selected')
      setEndXYForCurrentPath()

      // if path stopped in the same spot it started, and path type is not text, delete it
      const activePath = paths[activePathId]
      if (activePath.type !== 'text' && activePath.x1 === activePath.x2 && activePath.y1 === activePath.y2) {
        deletePath(activePathId)
      }
    }
  }

  const keydownEvents = (e) => {

    if (activityState === 'selected' && document.activeElement?.type !== 'textarea') {
      if (e.keyCode === 13) {
        setActivityState('create')
      }
  
      if (e.keyCode === 8) {
        deletePath(activePathId)
      }
    }
  }

  useEffect(() => {
    const deactiveatePaths = (e) => {
      if (e.shiftKey) setShiftActive(true)

      if (!svgRef.current.contains(e.target)
        && e.target.id !== 'selection-box'
        && e.target.attributes?.class?.value !== 'resize-handle'
        && e.target.attributes?.class?.value !== 'annotations-textarea'
      ) {
        setActivityState('create')
      }
    }

    const setShiftInactive = () => setShiftActive(false)

    window.addEventListener('mousedown', deactiveatePaths)
    window.addEventListener('mouseup', setShiftInactive)

    window.addEventListener('keydown', keydownEvents)

    return () => {
      window.removeEventListener('mousedown', deactiveatePaths)
      window.removeEventListener('mouseup', setShiftInactive)

      window.removeEventListener('keydown', keydownEvents)
    }
  }, [activityState, activePathId])

  const setEndXYForCurrentPath = () => {
    const activePath = paths[activePathId]
    
    const xDiff = Math.abs(x - activePath.x1)
    const yDiff = Math.abs(y - activePath.y1)

    const leastVal = xDiff < yDiff ? xDiff : yDiff

    let quadrant = 'one'

    if (x > activePath.x1 && y > activePath.y1) quadrant = 'one'
    else if (x < activePath.x1 && y > activePath.y1) quadrant = 'two'
    else if (x < activePath.x1 && y < activePath.y1) quadrant = 'three'
    else if (x > activePath.x1 && y < activePath.y1) quadrant = 'four'

    const calcShiftActiveX = (x1Val) => {
      return quadrant === 'one' || quadrant === 'four'
        ? x1Val + leastVal
        : x1Val - leastVal
    }

    const calcShiftActiveY = (y1Val) => {
      return quadrant === 'one' || quadrant === 'two'
        ? y1Val + leastVal
        : y1Val - leastVal
    }


    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        x2: shiftActive ? calcShiftActiveX(activePath.x1) : x,
        y2: shiftActive ? calcShiftActiveY(activePath.y1) : y,
        pageX2: shiftActive ? calcShiftActiveX(activePath.pageX1) : pageX,
        pageY2: shiftActive ? calcShiftActiveY(activePath.pageY1) : pageY,
      }
    }

    setPaths(newPaths)
  }


  useEffect(() => {
    if(activityState === 'drag') {
      setEndXYForCurrentPath()
    }
  }, [x, y, activityState, shiftActive])


  const undo = () => {
    const lastPathId = paths.pathOrder[paths.pathOrder.length - 1]

    const newPathOrder = paths.pathOrder.filter(pathId => pathId !== lastPathId)

    const newPaths = {
      ...paths,
      pathOrder: newPathOrder,
    }

    delete newPaths[lastPathId]

    setPaths(newPaths)
  }

  const deletePath = (deletionPathId) => {
    setActivePathId(null)
    setActivityState('create')

    const newPathOrder = paths.pathOrder.filter(pathId => pathId !== deletionPathId)

    const newPaths = { ...paths, pathOrder: newPathOrder }

    delete newPaths[deletionPathId]

    setPaths(newPaths)
  }

  const save = async () => {
    const uri = await svgAsDataUri(document.querySelector('#svg-board'))
    onSave(uri)
  }

  const handleEditText = (e) => {
    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        textContent: e.target.value,
      }
    }

    setPaths(newPaths)
  }


  useEffect(() => {
    if (activePathId && activityState === 'selected') {
      const newPaths = {
        ...paths,
        [activePathId]: {
          ...paths[activePathId],
          color: activeColor,
          strokeWidth: activeStrokeWidth,
          fontSize: activeFontSize,
        }
      }
      setPaths(newPaths)
    }
  }, [activeColor, activeStrokeWidth, activeFontSize, activePathId, activityState])


  // selected handles logic!

  const adjustNW = () => {
    const activePath = paths[activePathId]

    const leftXs = activePath.x1 < activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']
    const topYs = activePath.y1 < activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [leftXs[0]]: x,
        [topYs[0]]: y,
        [leftXs[1]]: pageX,
        [topYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustN = () => {
    const activePath = paths[activePathId]

    const topYs = activePath.y1 < activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [topYs[0]]: y,
        [topYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustNE = () => {
    const activePath = paths[activePathId]

    const rigthXs = activePath.x1 > activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']
    const topYs = activePath.y1 < activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [rigthXs[0]]: x,
        [topYs[0]]: y,
        [rigthXs[1]]: pageX,
        [topYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustW = () => {
    const activePath = paths[activePathId]

    const leftXs = activePath.x1 < activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [leftXs[0]]: x,
        [leftXs[1]]: pageX,
      }
    }

    setPaths(newPaths)
  }

  const adjustE = () => {
    const activePath = paths[activePathId]

    const rigthXs = activePath.x1 > activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [rigthXs[0]]: x,
        [rigthXs[1]]: pageX,
      }
    }

    setPaths(newPaths)
  }

  const adjustSW = () => {
    const activePath = paths[activePathId]

    const leftXs = activePath.x1 < activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']
    const bottomYs = activePath.y1 > activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [leftXs[0]]: x,
        [bottomYs[0]]: y,
        [leftXs[1]]: pageX,
        [bottomYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustS = () => {
    const activePath = paths[activePathId]

    const bottomYs = activePath.y1 > activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [bottomYs[0]]: y,
        [bottomYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustSE = () => {
    const activePath = paths[activePathId]

    const rigthXs = activePath.x1 > activePath.x2 ? ['x1', 'pageX1'] : ['x2', 'pageX2']
    const bottomYs = activePath.y1 > activePath.y2 ? ['y1', 'pageY1'] : ['y2', 'pageY2']

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        [rigthXs[0]]: x,
        [bottomYs[0]]: y,
        [rigthXs[1]]: pageX,
        [bottomYs[1]]: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustX1Y1 = () => {
    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        x1: x,
        y1: y,
        pageX1: pageX,
        pageY1: pageY,
      }
    }

    setPaths(newPaths)
  }

  const adjustX2Y2 = () => {
    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        x2: x,
        y2: y,
        pageX2: pageX,
        pageY2: pageY,
      }
    }

    setPaths(newPaths)
  }

  const moveSelection = (dragRelationaryPositions) => {

    const newPaths = {
      ...paths,
      [activePathId]: {
        ...paths[activePathId],
        x1: x + dragRelationaryPositions.x1,
        y1: y + dragRelationaryPositions.y1,
        x2: x + dragRelationaryPositions.x2,
        y2: y + dragRelationaryPositions.y2,
        pageX1: pageX + dragRelationaryPositions.x1,
        pageY1: pageY + dragRelationaryPositions.y1,
        pageX2: pageX + dragRelationaryPositions.x2,
        pageY2: pageY + dragRelationaryPositions.y2,
      }
    }

    setPaths(newPaths)
  }


  const handleTextMouseDown = (pathId) => {
    setActivePathId(pathId)

    const activePath = paths[pathId]

    const relationaryPos = {
      x1: activePath.x1 - x,
      y1: activePath.y1 - y,
      x2: activePath.x2 - x,
      y2: activePath.y2 - y,
    }
    
    setTextDragRelationaryPositions(relationaryPos)
    setIsDragginText(true)

  }

  const handleTextMouseUp = () => {
    setIsDragginText(false)
  }

  useEffect(() => {
    if (isDraggingText) {
      moveSelection(textDragRelationaryPositions)
    }
  }, [x, y, isDraggingText])

  return (
    <>
      <svg
        id='svg-board'
        ref={svgRef}
        style={{
          display: 'flex',
          height: imgRef?.current?.getBoundingClientRect?.()?.height,
          width: imgRef?.current?.getBoundingClientRect?.()?.width,
          cursor: activityState === 'create' ? 'crosshair' : 'auto'
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        <image ref={imgRef} xlinkHref={imgSrc} style={{ ...imgStyles }} />
        {Object.keys(paths).map((pathId) => {
          const path = paths[pathId]

          let pathElement


          if (path?.type === 'ellipse') {
            const avgX = (path.x2 + path.x1)/2
            const avgY = (path.y2 + path.y1)/2
    
            const width = Math.abs(path.x2 - path.x1)
            const height = Math.abs(path.y2 - path.y1)
    
            pathElement = (
              <ellipse cx={`${avgX}`} cy={`${avgY}`} rx={width - (width/2)} ry={height - (height/2)} key={pathId} name={pathId} fill='transparent' stroke={path.color} strokeWidth={`${path.strokeWidth}px`} style={{ cursor: activityState === 'create' ? 'pointer' : 'auto' }} />
            )
          }

          if (path?.type === 'rect') {
            const left = path.x1 < path.x2 ? path.x1 : path.x2
            const top = path.y1 < path.y2 ? path.y1 : path.y2
    
            const width = Math.abs(path.x2 - path.x1)
            const height = Math.abs(path.y2 - path.y1)
    
            pathElement = (
              <rect x={left} y={top} width={width} height={height} key={pathId} name={pathId} fill='transparent' stroke={path.color} strokeWidth={`${path.strokeWidth}px`} style={{ cursor: activityState === 'create' ? 'pointer' : 'auto' }} />
            )
          }

          if (path?.type === 'line') {
            pathElement = (
              <line x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} key={pathId} name={pathId} fill='transparent' stroke={path.color} strokeWidth={`${path.strokeWidth}px`} style={{ cursor: activityState === 'create' ? 'pointer' : 'auto' }} />
            )
          }

          if (path.type === 'arrow') {
            pathElement = (
              <>
                <defs key={`${pathId}_arrowhead`}>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto" fill='red'>
                    <polygon points="0 0, 10 3.5, 0 7" fill='red' />
                  </marker>
                </defs>
                <line x1={path.x1} y1={path.y1} x2={path.x2} y2={path.y2} key={pathId} name={pathId} fill='transparent' stroke={path.color} strokeWidth={`${path.strokeWidth}px`} style={{ cursor: activityState === 'create' ? 'pointer' : 'auto' }} markerEnd="url(#arrowhead)" />
              </>
            )
          }

          if (path?.type === 'text') {
            pathElement = (
              <text x={path.x1} y={path.y1} fill={path.color} key={pathId} name={pathId} style={{ fontSize: path.fontSize, cursor: activePathId === pathId ? 'move' : 'text' }} onMouseDown={() => handleTextMouseDown(pathId)} onMouseUp={handleTextMouseUp}>{path.textContent}</text>
            )
          }

          return (
            <>
              {pathElement}
            </>
          )
        })}
      </svg>
      {
        children?.({
          activeColor,
          activeStrokeWidth,
          activeType,
          activeFontSize,
          setActiveColor,
          setActiveStrokeWidth,
          setActiveType,
          setActiveFontSize,
          undo,
          save,
          deletePath,
          activePathId,
        })
      }
      {
        activityState === 'selected' && paths[activePathId]?.type === 'text'
          ? (
            <textarea
              className='annotations-textarea'
              style={{ position: 'absolute', left: paths[activePathId].pageX1, top: paths[activePathId].pageY1 + 20 }}
              value={paths[activePathId].textContent}
              onChange={handleEditText}
            />
          )
          : null
      }
      {
        activityState === 'selected'
          ? (
            <SelectionBox
              activePath={paths[activePathId]}
              x={x}
              y={y}
              adjustNW={adjustNW}
              adjustNE={adjustNE}
              adjustSE={adjustSE}
              adjustSW={adjustSW}
              adjustN={adjustN}
              adjustE={adjustE}
              adjustS={adjustS}
              adjustW={adjustW}
              adjustX1Y1={adjustX1Y1}
              adjustX2Y2={adjustX2Y2}
              move={moveSelection}
              hideHandles={paths[activePathId]?.type === 'text'}
            />
          )
          : null
      }
    </>
  )
}

ImgMarkup.propTypes = {
  children: PropTypes.func,
  imgSrc: PropTypes.string,
  imgStyles: PropTypes.object,
  onSave: PropTypes.func,
}

ImgMarkup.defaultProps = {
  children: () => {},
  imgSrc: '',
  imgStyles: {},
  onSave: () => {},
}

export default ImgMarkup