"use client"

import { useMemo, useRef, useState, useEffect, useCallback, useLayoutEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"
import { FaTelegramPlane, FaCopy, FaTwitter, FaMagic } from "react-icons/fa"

function formatUsd(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return "-"
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  })
}

function compoundFutureValue(principal, annualRate, years) {
  const p = Number(principal)
  const r = Number(annualRate)
  const t = Number(years)
  if (!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(t)) return Number.NaN
  return p * Math.pow(1 + r, t)
}

function buildAnnualSchedule(principal, annualRate, years) {
  const p = Number(principal)
  const r = Number(annualRate)
  const t = Number(years)
  if (!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(t)) return []
  const rows = []
  let balance = p
  for (let y = 1; y <= t; y++) {
    const start = balance
    const end = start * (1 + r)
    const interest = end - start
    rows.push({ year: y, start, interest, end })
    balance = end
  }
  return rows
}

function buildShareText({ invested, pnl, realized, unrealized }) {
  const textParts = [
    "Trading Wrapped 2024",
    `Invested: ${formatUsd(invested)}`,
    `PnL: ${formatUsd(pnl)}`,
    `Realized: ${formatUsd(realized)}`,
    `Unrealized: ${formatUsd(unrealized)}`,
  ]
  return textParts.join(" · ")
}

const COMP_YEARS = 5
const COMP_RATES = [0.05, 0.15, 0.25]
const MAX_STEP = 5
const USE_MOCK = true
const EASE = [0.16, 1, 0.3, 1]
const DURATION_IN = 0.7
const DURATION_OUT = 0.7

function getMockResponse() {
  const investedUsd = 12850.0
  const realizedPnlUsd = 1804.4
  const unrealizedPnlUsd = 646.23
  const pnl = realizedPnlUsd + unrealizedPnlUsd
  const holdings = { ETH: 0.85, ARB: 260, OP: 120 }
  const holdingsValueUsd = 7350.0
  return { pnl, realizedPnlUsd, unrealizedPnlUsd, investedUsd, holdings, holdingsValueUsd }
}

function AutoSizeText({ text, maxPx = 120, minPx = 36, className = "" }) {
  const containerRef = useRef(null)
  const spanRef = useRef(null)
  const [fontSize, setFontSize] = useState(maxPx)

  useEffect(() => {
    const resize = () => {
      const container = containerRef.current
      const span = spanRef.current
      if (!container || !span) return
      const available = Math.max(0, container.clientWidth - 8)
      let size = maxPx
      span.style.fontSize = `${size}px`
      span.style.whiteSpace = "nowrap"
      span.style.display = "inline-block"
      while (span.scrollWidth > available && size > minPx) {
        size -= 2
        span.style.fontSize = `${size}px`
      }
      setFontSize(size)
    }
    resize()
    let ro
    let containerEl = containerRef.current
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize)
      if (containerEl) ro.observe(containerEl)
    }
    window.addEventListener("resize", resize)
    return () => {
      window.removeEventListener("resize", resize)
      if (ro && containerEl) ro.unobserve(containerEl)
    }
  }, [text, maxPx, minPx])

  return (
    <div ref={containerRef} className="w-full">
      <span ref={spanRef} className={className} style={{ fontSize }}>{text}</span>
    </div>
  )
}

function ChartTransition({ onComplete, loop = false }) {
  const data = useMemo(() => [12, 26, 36, 32, 48, 64, 86], [])
  const maxValue = 100
  useEffect(() => {
    if (loop) return
    const t = setTimeout(() => {
      onComplete?.()
    }, 2400)
    return () => clearTimeout(t)
  }, [loop, onComplete])

  const chartWidth = 720
  const chartHeight = 220
  const paddingX = 28
  const paddingY = 20
  const innerW = chartWidth - paddingX * 2
  const innerH = chartHeight - paddingY * 2
  const n = data.length
  const stepX = n > 1 ? innerW / (n - 1) : innerW

  // Single timeline for stable looping
  const TOTAL = 6.0
  const REVEAL = 5
  const WIPE = 1.2
  const HOLD = Math.max(0, TOTAL - REVEAL - WIPE)
  const BAR_RISE = 0.6
  const DOT_RISE = 0.3
  // Ensure last bar has full rise time by finishing exactly at REVEAL
  const STAGGER = n > 1 ? Math.max(0, (REVEAL - BAR_RISE) / (n - 1)) : 0
  const LINE_DURATION = REVEAL + HOLD
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
  const EPS = 0.0005

  const points = data.map((v, i) => {
    const centerX = paddingX + i * stepX
    const x = centerX
    const y = paddingY + innerH * (1 - Math.min(1, Math.max(0, v / maxValue)))
    return `${x},${y}`
  }).join(" ")

  return (
    <motion.div
      key="chart-transition"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-gradient-to-br from-primary/30 via-background/95 to-accent/30 backdrop-blur-md animate-gradient"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 1.2, ease: EASE } }}
      transition={{ duration: DURATION_IN, ease: EASE }}
    >
      <div className="relative w-[90vw] max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 1.2, ease: EASE } }}
          transition={{ duration: DURATION_IN, ease: EASE }}
          className="rounded-2xl border border-primary/20 bg-card/70 backdrop-blur-md shadow-2xl p-5"
        >
          <div className="w-full overflow-hidden">
            <div className="mx-auto max-w-3xl">
              <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                  </linearGradient>
                  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <g>
                  {/* grid lines */}
                  {Array.from({ length: 4 }).map((_, i) => {
                    const y = paddingY + (innerH / 4) * (i + 1)
                    return (
                      <motion.line
                        key={`grid-${i}`}
                        x1={paddingX}
                        x2={paddingX + innerW}
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-foreground/10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.08 * i }}
                      />
                    )
                  })}

                  {data.map((v, i) => {
                    const norm = Math.min(1, Math.max(0, v / maxValue))
                    const barW = 20
                    const centerX = paddingX + i * stepX
                    const x = centerX - barW / 2
                    const h = innerH * norm
                    const y = paddingY + (innerH - h)
                    const startSec = i * STAGGER
                    const riseEndSec = Math.min(startSec + BAR_RISE, REVEAL)
                    const wipeStartSec = REVEAL + HOLD
                    const t0 = 0
                    const tStart = clamp(startSec / TOTAL, EPS, 1 - EPS)
                    const tRiseEnd = clamp(riseEndSec / TOTAL, tStart + EPS, 1 - EPS)
                    const tWipeStart = clamp(wipeStartSec / TOTAL, tRiseEnd + EPS, 1 - EPS)
                    return (
                      <motion.rect
                        key={i}
                        x={x}
                        y={y}
                        width={barW}
                        height={h}
                        rx="6"
                        className="fill-primary/70"
                        initial={loop ? { scaleY: 0, opacity: 1 } : { height: 0, opacity: 1, y: paddingY + innerH }}
                        animate={loop ? { scaleY: [0, 0, 1, 1, 0], opacity: [1, 1, 1, 1, 1] } : { height: h, opacity: 1, y }}
                        transition={loop ? { duration: TOTAL, ease: "linear", times: [t0, tStart, tRiseEnd, tWipeStart, 1], repeat: Infinity, repeatType: "loop" } : { duration: BAR_RISE, ease: EASE, delay: startSec }}
                        style={loop ? { originY: 1 } : undefined}
                      />
                    )
                  })}
                  <motion.polyline
                    points={points}
                    fill="url(#chartFill)"
                    className="text-primary"
                    initial={{ opacity: 0 }}
                    animate={loop ? { opacity: [0, 0.8, 0.8, 0] } : { opacity: 1 }}
                    transition={loop ? { duration: TOTAL, ease: "linear", times: [0, REVEAL / TOTAL, (REVEAL + HOLD) / TOTAL, 1], repeat: Infinity, repeatType: "loop" } : { duration: LINE_DURATION, ease: EASE }}
                  />
                  <motion.polyline
                    points={points}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                    filter="url(#glow)"
                    initial={{ pathLength: 0 }}
                    animate={loop ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1 }}
                    transition={loop ? { duration: TOTAL, ease: "linear", times: [0, REVEAL / TOTAL, (REVEAL + HOLD) / TOTAL, 1], repeat: Infinity, repeatType: "loop" } : { duration: LINE_DURATION, ease: EASE }}
                    style={{ pathLength: 1 }}
                  />
                  {data.map((v, i) => {
                    const centerX = paddingX + i * stepX
                    const x = centerX
                    const y = paddingY + innerH * (1 - Math.min(1, Math.max(0, v / maxValue)))
                    const barStartSec = i * STAGGER
                    const startSec = Math.min(barStartSec + BAR_RISE * 0.85, REVEAL)
                    const riseEndSec = Math.min(startSec + DOT_RISE, REVEAL)
                    const wipeStartSec = REVEAL + HOLD
                    const t0 = 0
                    const tStart = clamp(startSec / TOTAL, EPS, 1 - EPS)
                    const tRiseEnd = clamp(riseEndSec / TOTAL, tStart + EPS, 1 - EPS)
                    const tWipeStart = clamp(wipeStartSec / TOTAL, tRiseEnd + EPS, 1 - EPS)
                    return (
                      <motion.circle
                        key={`dot-${i}`}
                        cx={x}
                        cy={y}
                        r="5.5"
                        className="fill-background stroke-primary"
                        strokeWidth="3"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={loop ? { opacity: [0, 0, 1, 1, 0], scale: [0.9, 0.9, 1, 1, 0.9] } : { scale: 1, opacity: 1 }}
                        transition={loop ? { duration: TOTAL, ease: "linear", times: [t0, tStart, tRiseEnd, tWipeStart, 1], repeat: Infinity, repeatType: "loop" } : { duration: DOT_RISE, ease: EASE, delay: startSec }}
                      />
                    )
                  })}
                </g>
              </svg>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

export default function Home() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef(null)
  const [xHandle, setXHandle] = useState("")
  const [cardReady, setCardReady] = useState(false)
  const [redrawTick, setRedrawTick] = useState(0)
  const formRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setResult(null)
    setCurrentStep(0)

    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address.trim())
    if (!isEvm) {
      setError("Enter a valid EVM address (0x... 40 hex)")
      return
    }

    setLoading(true)
    try {
      if (USE_MOCK) {
        // Simulate network latency of 3s as requested
        await new Promise((r) => setTimeout(r, 3000))
        const data = getMockResponse()
        setResult(data)
        setCurrentStep(1)
        setTimeout(() => setLoading(false), 120)
        return
      }

      const res = await fetch("/api/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Error requesting Moralis")
      } else {
        setResult(data)
        setCurrentStep(1)
        setTimeout(() => setLoading(false), 120)
      }
    } catch (err) {
      setError("Network error. Please try again later.")
      setLoading(false)
    }
  }

  const invested = useMemo(() => Number(result?.investedUsd) || 0, [result])
  const pnl = useMemo(() => Number(result?.pnl) || 0, [result])
  const realized = useMemo(() => Number(result?.realizedPnlUsd) || 0, [result])
  const unrealized = useMemo(() => Number(result?.unrealizedPnlUsd) || 0, [result])

  const conservativeSproutApy = 0.10
  const sproutFinal = useMemo(() => compoundFutureValue(invested, conservativeSproutApy, COMP_YEARS), [invested])
  const sproutProfit = useMemo(() => Math.max(0, sproutFinal - invested), [sproutFinal, invested])

  const compounds = useMemo(() => {
    if (!Number.isFinite(invested) || invested <= 0) return []
    return COMP_RATES.map((r) => {
      const final = compoundFutureValue(invested, r, COMP_YEARS)
      const earnings = final - invested
      const schedule = buildAnnualSchedule(invested, r, COMP_YEARS)
      return { rate: r, final, earnings, schedule }
    })
  }, [invested])

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => (prev < MAX_STEP ? prev + 1 : prev))
  }, [])

  

  function fillDemoAddress() {
    setAddress("0x4d26f0e78c154f8fda7acf6646246fa135507017")
  }

  const restart = () => {
    setCurrentStep(0)
    setResult(null)
    setAddress("")
  }

  const shareUrl = typeof window !== "undefined" ? window.location.origin : ""
  const shareText = useMemo(
    () => buildShareText({ invested, pnl, realized, unrealized }),
    [invested, pnl, realized, unrealized]
  )

  function openShare(url) {
    if (typeof window === "undefined") return
    window.open(url, "_blank", "noopener,noreferrer")
  }

  async function copyShareToClipboard() {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (_) {
      // ignore
    }
  }

  function shareOnX() {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
    openShare(url)
  }

  function shareOnTelegram() {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`
    openShare(url)
  }

  async function triggerConfetti() {
    try {
      const mod = await import("canvas-confetti")
      const confetti = mod.default || mod
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      })
    } catch (_) {
      // ignore
    }
  }

  // Keyboard navigation across steps
  useEffect(() => {
    function onKeyDown(e) {
      const tag = e.target?.tagName?.toLowerCase()
      const isTyping = tag === "input" || tag === "textarea" || e.target?.isContentEditable
      if (isTyping) return
      if (e.key === "ArrowRight") {
        nextStep()
      } else if (e.key === "ArrowLeft") {
        // no prev button, but still allow going back via keyboard
        if (currentStep > 1) setCurrentStep(currentStep - 1)
      } else if (e.key === "Enter" && currentStep >= 1 && currentStep < 5) {
        nextStep()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [currentStep, nextStep])

  // Auto-generate image when entering Step 5 (no confetti)
  useEffect(() => {
    if (currentStep === 5 && cardReady) {
      drawShareCard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, cardReady])

  // Keep canvas in sync if inputs change while on Step 5 (no confetti)
  useLayoutEffect(() => {
    if (currentStep === 5 && cardReady) {
      drawShareCard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invested, pnl, realized, unrealized, sproutProfit, xHandle, redrawTick])

  // ChartTransition controls its own completion via onComplete

  // Celebrate green PnL on Step 3
  useEffect(() => {
    if (currentStep === 3 && pnl > 0) {
      triggerConfetti()
    }
  }, [currentStep, pnl])

  function drawShareCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    const width = 1200
    const height = 520
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height)
    grad.addColorStop(0, "#e6f9ef")
    grad.addColorStop(1, "#d0f2e5")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    // Decorative circles
    ctx.globalAlpha = 0.2
    ctx.fillStyle = "#34d399"
    ctx.beginPath(); ctx.arc(1100, 80, 120, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(150, 550, 160, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1

    // Helpers
    const setFont = (weight, sizePx) => {
      ctx.font = `${weight} ${sizePx}px Inter, system-ui, -apple-system, Segoe UI, Roboto`
    }
    const fitFontSize = (text, weight, maxPx, minPx, maxWidth) => {
      let size = maxPx
      while (size > minPx) {
        setFont(weight, size)
        const w = ctx.measureText(text).width
        if (w <= maxWidth) return size
        size -= 2
      }
      return minPx
    }
    const roundRect = (x, y, w, h, r) => {
      const rr = Math.min(r, h / 2, w / 2)
      ctx.beginPath()
      ctx.moveTo(x + rr, y)
      ctx.arcTo(x + w, y, x + w, y + h, rr)
      ctx.arcTo(x + w, y + h, x, y + h, rr)
      ctx.arcTo(x, y + h, x, y, rr)
      ctx.arcTo(x, y, x + w, y, rr)
      ctx.closePath()
    }

    // Username area (top center)
    const handle = xHandle?.trim() ? (xHandle.trim().startsWith("@") ? xHandle.trim() : `@${xHandle.trim()}`) : "@yourname"
    const username = handle
    setFont("600", 28)
    const nameWidth = ctx.measureText(username).width
    const pillPadX = 18
    const pillPadY = 12
    const pillW = nameWidth + pillPadX * 2
    const pillH = 48
    const pillX = (width - pillW) / 2
    const pillY = 28
    ctx.fillStyle = "rgba(255,255,255,0.9)"
    roundRect(pillX, pillY, pillW, pillH, 24)
    ctx.fill()
    ctx.fillStyle = "#065f46"
    setFont("600", 28)
    ctx.fillText(username, pillX + pillPadX, pillY + pillH - pillPadY)

    // Comparison layout with vertical divider
    const topMargin = 120
    const sideMargin = 60
    const bottomMargin = 60
    const midX = width / 2
    const colWidth = midX - sideMargin * 2

    // Vertical divider
    ctx.strokeStyle = "rgba(6,78,59,0.2)"
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(midX, topMargin); ctx.lineTo(midX, height - bottomMargin); ctx.stroke()

    // Left column: Trading PnL
    const leftX = sideMargin
    let y = topMargin + 36
    ctx.fillStyle = "#064e3b"
    let heading = "My 2025 Trading PnL"
    let headingSize = fitFontSize(heading, "600", 36, 22, colWidth)
    setFont("600", headingSize)
    ctx.fillText(heading, leftX, y)

    y += 88
    const pnlText = formatUsd(pnl)
    const pnlSize = fitFontSize(pnlText, "bold", 88, 40, colWidth)
    ctx.fillStyle = pnl >= 0 ? "#059669" : "#dc2626"
    setFont("bold", pnlSize)
    ctx.fillText(pnlText, leftX, y)

    y += 42
    ctx.fillStyle = "#065f46"
    setFont("500", 24)
    ctx.fillText("Realized + unrealized PnL (trading)", leftX, y)

    // Right column: Sprout PnL
    const rightX = midX + sideMargin
    y = topMargin + 36
    ctx.fillStyle = "#065f46"
    heading = "Sprout 10% APY · 5 years"
    headingSize = fitFontSize(heading, "600", 36, 22, colWidth)
    setFont("600", headingSize)
    ctx.fillText(heading, rightX, y)

    y += 88
    const sproutText = formatUsd(sproutProfit)
    const sproutSize = fitFontSize(sproutText, "bold", 88, 40, colWidth)
    ctx.fillStyle = "#047857"
    setFont("bold", sproutSize)
    ctx.fillText(sproutText, rightX, y)

    y += 42
    ctx.fillStyle = "#065f46"
    setFont("500", 24)
    ctx.fillText("Conservative strategy estimated profit", rightX, y)

  }

  async function downloadShareCard() {
    drawShareCard()
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = "sproutcard.png"
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function copyShareCard() {
    drawShareCard()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      try {
        // @ts-ignore - ClipboardItem exists in browsers
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch (_) {
        // fallback: open image in new tab
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
      }
    })
  }

  const showSteps = result && currentStep > 0

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10 animate-gradient" />
      {/* Animated decorative shapes */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-primary/20 blur-3xl animate-float-slow" />

      {/* Global loading overlay: keep one stable instance to avoid restart */}
      <AnimatePresence>
        {loading && (
          <ChartTransition key="loading-chart-global" loop onComplete={() => {}} />
        )}
      </AnimatePresence>

      {/* Content */}
      {!showSteps && (
        <main className="w-full max-w-4xl mx-auto p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-8 relative z-10">
          <div className="text-center mb-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              Sprouted?
            </h1>
            <p className="text-xl text-muted-foreground">Let&apos;s unveil your onchain trading PNL</p>
          </div>

          <Card className="p-8 bg-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
            <form onSubmit={handleSubmit} ref={formRef} className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <label className="text-lg font-medium text-foreground">Enter your EVM address</label>
                <div className="flex gap-2 items-center">
                  <input
                    className="flex-1 border border-input rounded-xl px-4 py-3 bg-input text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200 text-lg"
                    placeholder="0x..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={fillDemoAddress} title="Use demo address">Demo</Button>
                </div>
                <span className="text-xs text-muted-foreground">We only fetch public onchain data.</span>
              </div>

              {error && (
                <div
                  className="text-destructive text-sm bg-destructive/10 p-3 rounded-lg border border-destructive/20"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                disabled={loading}
              >
                {loading ? "Analyzing your trades..." : "Summon the alpha →"}
              </Button>
            </form>
          </Card>
        </main>
      )}

      {showSteps && (
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key={1}
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: DURATION_IN, ease: EASE }}
              className="relative z-10 min-h-[100svh] flex items-center justify-center p-4 sm:p-6"
            >
              <div className="text-center max-w-2xl">
                <div className="mb-8">
                  <h1 className="text-5xl md:text-7xl font-bold leading-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                    2025
                  </h1>
                  <h2 className="text-xl md:text-3xl font-semibold text-foreground mb-2">Your Trading Year</h2>
                  <p className="text-lg text-muted-foreground">Let&apos;s dive into your onchain trading journey</p>
                  <p className="text-sm text-muted-foreground mt-2">Spoiler: there&apos;s green… somewhere. Probably. 👀</p>
                </div>
                <Button
                  onClick={nextStep}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-glow"
                >
                  Show me my stats ✨
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key={2}
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: DURATION_IN, ease: EASE }}
              className="relative z-10 min-h-[100svh] flex items-center justify-center p-4 sm:p-6"
            >
              <div className="text-center max-w-2xl">
                <div className="mb-12 w-full max-w-[90vw] md:max-w-2xl">
                  <p className="text-lg text-muted-foreground">You invested approx.</p>
                  <AutoSizeText
                    text={formatUsd(invested)}
                    maxPx={104}
                    minPx={24}
                    className="font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent leading-tight block"
                  />
                  <p className="text-xl text-muted-foreground">in onchain trading this year</p>
                  <p className="text-sm text-muted-foreground mt-2">We didn&apos;t count your legendary “just ape” moments. Yet. 🦍</p>
                </div>
                <Button
                  onClick={nextStep}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
                >
                  What about my returns? 📈
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key={3}
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: DURATION_IN, ease: EASE }}
              className="relative z-10 min-h-[100svh] flex items-center justify-center p-4 sm:p-6"
            >
              <div className="text-center max-w-3xl">
                <div className="mb-12">
                  <p className="text-lg text-muted-foreground mb-4">Your total PnL was</p>
                  <AutoSizeText
                    text={formatUsd(pnl)}
                    maxPx={104}
                    minPx={28}
                    className={`font-bold mb-6 leading-tight ${pnl >= 0 ? "text-primary" : "text-destructive"}`}
                  />
                  <p className="text-sm text-muted-foreground">If it&apos;s red, we blame the market maker. If it&apos;s green, skill issue (yours). 😉</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
                      <div className="text-sm text-muted-foreground mb-2">Realized</div>
                      <div className={`text-3xl font-bold ${realized >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatUsd(realized)}
                      </div>
                    </Card>
                    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
                      <div className="text-sm text-muted-foreground mb-2">Unrealized</div>
                      <div className={`text-3xl font-bold ${unrealized >= 0 ? "text-primary" : "text-destructive"}`}>
                        {formatUsd(unrealized)}
                      </div>
                    </Card>
                  </div>
                </div>
                <Button
                  onClick={nextStep}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
                >
                  But what if... 🤔
                </Button>
              </div>
            </motion.div>
          )}

          {currentStep === 4 && (
            <motion.div
              key={4}
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: DURATION_IN, ease: EASE }}
              className="relative z-10 min-h-[100svh] flex items-center justify-center p-4 sm:p-6"
            >
              <div className="text-center max-w-5xl">
                <div className="mb-12">
                  <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
                    What if you invested in Sprout instead?
                  </h2>
                  <p className="text-lg text-muted-foreground mb-2">
                    Here&apos;s what your {formatUsd(invested)} could have earned with compound interest
                  </p>
                  <p className="text-sm text-muted-foreground">Math is honest. Markets… not always. 📚</p>

                  {invested > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-6 md:mt-8">
                      {compounds.map((c, index) => (
                        <motion.div key={c.rate} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
                          <Card
                            className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105"
                          >
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary mb-2">{Math.round(c.rate * 100)}% APY</div>
                              <div className="text-3xl sm:text-4xl font-bold text-foreground mb-2 leading-tight">{formatUsd(c.earnings)}</div>
                              <div className="text-sm text-muted-foreground mb-4">Total: {formatUsd(c.final)}</div>
                              <div className="text-xs text-muted-foreground">Over 5 years</div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No invested amount detected.</p>
                  )}
                </div>

                <div className="flex gap-4 justify-center">
                  <Button
                    onClick={nextStep}
                    size="lg"
                    className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
                  >
                    Share my stats 📣
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 5 && (
            <motion.div
              key={5}
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: DURATION_IN, ease: EASE }}
              className="relative z-10 min-h-screen flex items-center justify-center p-6"
            >
              <div className="text-center w-full">
                <div className="mx-auto w-full max-w-3xl flex flex-col items-center gap-4">
                  {!cardReady && (
                    <div className="w-full flex flex-col sm:flex-row gap-3 items-center justify-center">
                      <input
                        className="border border-input rounded-xl px-4 py-3 bg-input text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200 text-lg w-full sm:w-80"
                        placeholder="Your X handle (e.g., @trader)"
                        value={xHandle}
                        onChange={(e) => setXHandle(e.target.value)}
                      />
                      <Button onClick={() => { setCardReady(true); setTimeout(() => drawShareCard(), 0); }} className="px-6 gap-2"> <FaMagic /> Generate</Button>
                    </div>
                  )}
                  {cardReady && (
                    <>
                      <canvas ref={canvasRef} className="w-full h-auto rounded-xl shadow-2xl bg-white" />
                      <div className="flex flex-wrap gap-3 justify-center mt-2">
                        <Button onClick={downloadShareCard} variant="outline" className="px-6">Download PNG</Button>
                        <Button onClick={copyShareCard} className="px-6">{copied ? "Copied!" : "Copy image"}</Button>
                        <Button variant="outline" className="px-6" onClick={() => { setCardReady(false); }}>Edit handle</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Tag @sproutfi_xyz if it slaps 🔥</p>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Progress indicator - clickable dots */}
      {showSteps && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px))" }}>
          <div className="flex gap-3 items-center">
            {[1, 2, 3, 4, 5].map((step) => (
              <button
                key={step}
                onClick={() => setCurrentStep(step)}
                title={`Step ${step}`}
                className={`w-4 h-4 sm:w-3 sm:h-3 rounded-full transition-all duration-300 border-0 outline-none focus:outline-none focus:ring-0 p-0 ${
                  step === currentStep ? "bg-primary" : "bg-primary/20 hover:bg-primary/40"
                } cursor-pointer`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
