"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

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
        setTimeout(() => setCurrentStep(1), 500)
      }
    } catch (err) {
      setError("Network error. Please try again later.")
    } finally {
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

  const nextStep = () => {
    if (currentStep < MAX_STEP) {
      setCurrentStep(currentStep + 1)
    }
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

  // Auto-generate image when entering Step 5
  useEffect(() => {
    if (currentStep === 5 && cardReady) {
      drawShareCard()
    }
  }, [currentStep, pnl, invested, address, sproutProfit, xHandle, cardReady])

  function drawShareCard() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    const width = 1200
    const height = 520
    canvas.width = width * dpr
    canvas.height = height * dpr
    const ctx = canvas.getContext("2d")
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

  if (result && currentStep > 0) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10 animate-gradient" />
        {/* Animated decorative shapes */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/20 blur-3xl animate-float-slow" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-80 h-80 rounded-full bg-primary/20 blur-3xl animate-float-slow" />

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl animate-spin">🌿</div>
              <div className="text-lg text-muted-foreground">Loading data...</div>
            </div>
          </div>
        )}

        {/* Step 1: Welcome Screen */}
        {currentStep === 1 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-fade-in-scale">
            <div className="text-center max-w-2xl">
              <div className="mb-8">
                <h1 className="text-5xl md:text-7xl font-bold leading-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                  2025
                </h1>
                <h2 className="text-xl md:text-3xl font-semibold text-foreground mb-2">Your Trading Year</h2>
                <p className="text-lg text-muted-foreground">Let’s dive into your onchain trading journey</p>
              </div>
              <Button
                onClick={nextStep}
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-glow"
              >
                Show me my stats ✨
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Investment Amount */}
        {currentStep === 2 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-slide-in-up">
            <div className="text-center max-w-2xl">
              <div className="mb-12">
                <p className="text-lg text-muted-foreground mb-4">You invested</p>
                <div className="text-7xl md:text-9xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-6">
                  {formatUsd(invested)}
                </div>
                <p className="text-xl text-muted-foreground">in onchain trading this year</p>
              </div>
              <Button
                onClick={nextStep}
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
              >
                What about my returns? 📈
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: PnL Results */}
        {currentStep === 3 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-slide-in-up">
            <div className="text-center max-w-3xl">
              <div className="mb-12">
                <p className="text-lg text-muted-foreground mb-4">Your total PnL was</p>
                <div
                  className={`text-7xl md:text-9xl font-bold mb-6 ${pnl >= 0 ? "text-primary" : "text-destructive"}`}
                >
                  {formatUsd(pnl)}
                </div>
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
          </div>
        )}

        {/* Step 4: Potential Earnings */}
        {currentStep === 4 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-slide-in-up">
            <div className="text-center max-w-5xl">
              <div className="mb-12">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
                  What if you invested in Sprout instead?
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Here’s what your {formatUsd(invested)} could have earned with compound interest
                </p>

                {invested > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {compounds.map((c, index) => (
                      <Card
                        key={c.rate}
                        className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105"
                      >
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary mb-2">{Math.round(c.rate * 100)}% APY</div>
                          <div className="text-4xl font-bold text-foreground mb-2">{formatUsd(c.earnings)}</div>
                          <div className="text-sm text-muted-foreground mb-4">Total: {formatUsd(c.final)}</div>
                          <div className="text-xs text-muted-foreground">Over 5 years</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No invested amount detected.</p>
                )}
              </div>

              <div className="flex gap-4 justify-center">
                <Button
                  onClick={restart}
                  variant="outline"
                  size="lg"
                  className="px-8 py-4 text-lg rounded-full border-primary/20 hover:border-primary/40 bg-transparent"
                >
                  Try another address
                </Button>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
                >
                  Start investing with Sprout 🌱
                </Button>
                <Button
                  onClick={nextStep}
                  size="lg"
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full"
                >
                  Share my stats 📣
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Share - only the image */}
        {currentStep === 5 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-slide-in-up">
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
                    <Button onClick={() => setCardReady(true)} className="px-6">Generate</Button>
                  </div>
                )}
                {cardReady && (
                  <>
                    <canvas ref={canvasRef} className="w-full h-auto rounded-xl shadow-2xl bg-white" />
                    <div className="flex gap-3 justify-center mt-2">
                      <Button onClick={copyShareCard} className="px-6">{copied ? "Copied!" : "Copy image"}</Button>
                      <Button onClick={downloadShareCard} variant="outline" className="px-6">Download PNG</Button>
                      <Button variant="outline" className="px-6" onClick={() => { setCardReady(false); }}>Edit handle</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator (hidden on step 5) */}
        {currentStep !== 5 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    step <= currentStep ? "bg-primary" : "bg-primary/20"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen w-full max-w-4xl mx-auto p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-8">
      {loading && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-spin">🌿</div>
            <div className="text-lg text-muted-foreground">Loading data...</div>
          </div>
        </div>
      )}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
          bro
        </h1>
        <p className="text-xl text-muted-foreground">Discover your onchain trading journey vs. investing in Sprout</p>
      </div>

      <Card className="p-8 bg-card/50 backdrop-blur-sm border-primary/20 shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <label className="text-lg font-medium text-foreground">Enter your EVM address</label>
            <input
              className="border border-input rounded-xl px-4 py-3 bg-input text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200 text-lg"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
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
            {loading ? "Analyzing your trades..." : "Show me already ✨"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
