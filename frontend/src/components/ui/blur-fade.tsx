"use client"

import { useRef, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface BlurFadeProps {
  children: React.ReactNode
  className?: string
  duration?: number
  delay?: number
  offset?: number
  direction?: "up" | "down" | "left" | "right"
  inView?: boolean
  blur?: string
}

export function BlurFade({
  children,
  className,
  duration = 0.4,
  delay = 0,
  offset = 6,
  direction = "down",
  inView = false,
  blur = "6px",
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(!inView)

  useEffect(() => {
    if (!inView || !ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "-50px" }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [inView])

  const getTransform = () => {
    if (direction === "left") return `translateX(${offset}px)`
    if (direction === "right") return `translateX(-${offset}px)`
    if (direction === "up") return `translateY(${offset}px)`
    return `translateY(-${offset}px)`
  }

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        filter: isVisible ? "blur(0px)" : `blur(${blur})`,
        transform: isVisible ? "translate(0, 0)" : getTransform(),
        transition: `opacity ${duration}s ease-out ${delay}s, filter ${duration}s ease-out ${delay}s, transform ${duration}s ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  )
}
