"use client"

import {
  ComponentPropsWithoutRef,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

export interface AnimatedGridPatternProps
  extends ComponentPropsWithoutRef<"svg"> {
  width?: number
  height?: number
  x?: number
  y?: number
  strokeDasharray?: number
  numSquares?: number
  maxOpacity?: number
  duration?: number
  repeatDelay?: number
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  ...props
}: AnimatedGridPatternProps) {
  const id = useId()
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [squares, setSquares] = useState<Array<{ id: number; pos: [number, number] }>>([])

  function getPos(): [number, number] {
    if (dimensions.width === 0 || dimensions.height === 0) {
      return [0, 0]
    }
    return [
      Math.floor((Math.random() * dimensions.width) / width),
      Math.floor((Math.random() * dimensions.height) / height),
    ]
  }

  // Adjust the generateSquares function to return objects with an id, x, and y
  function generateSquares(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      pos: getPos(),
    }))
  }

  // Function to update a single square's position
  const updateSquarePosition = (id: number) => {
    setSquares((currentSquares) =>
      currentSquares.map((sq) =>
        sq.id === id
          ? {
              ...sq,
              pos: getPos(),
            }
          : sq
      )
    )
  }

  // Update squares to animate in
  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, numSquares])

  // Periodically update square positions for continuous animation
  useEffect(() => {
    if (squares.length === 0) return

    const interval = setInterval(() => {
      setSquares((currentSquares) =>
        currentSquares.map((sq) => ({
          ...sq,
          pos: getPos(),
        }))
      )
    }, duration * 1000 * 2) // Update every 2 animation cycles

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squares.length, duration])

  // Resize observer to update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = (containerRef.current as SVGSVGElement).getBoundingClientRect()
        setDimensions({
          width: rect.width || window.innerWidth,
          height: rect.height || window.innerHeight,
        })
      }
    }

    // Set initial dimensions
    updateDimensions()

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateDimensions)

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current)
      }
      window.removeEventListener('resize', updateDimensions)
    }
  }, [containerRef])

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 h-full w-full fill-blue-400/20 stroke-blue-400/20",
        className
      )}
      width="100%"
      height="100%"
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [x, y], id }, index) => (
          <motion.rect
            key={`${id}-${x}-${y}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration: duration / 2,
              repeat: Infinity,
              repeatType: "reverse",
              delay: index * 0.05,
              ease: "easeInOut",
            }}
            width={width - 1}
            height={height - 1}
            x={x * width + 1}
            y={y * height + 1}
            fill="currentColor"
            strokeWidth="0"
          />
        ))}
      </svg>
    </svg>
  )
}
