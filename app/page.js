"use client"

import { useMemo, useState } from "react"
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
    "#Sprout",
  ]
  return textParts.join(" · ")
}

const COMP_YEARS = 5
const COMP_RATES = [0.05, 0.15, 0.25]

export default function Home() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState(null)
  const [currentStep, setCurrentStep] = useState(0) // Added step tracking for Spotify Wrapped flow
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setResult(null)
    setCurrentStep(0) // Reset to beginning

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
    if (currentStep < 5) {
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

  if (result && currentStep > 0) {
    return (
      <div className="min-h-screen w-full relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10 animate-gradient" />

        {/* Step 1: Welcome Screen */}
        {currentStep === 1 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-fade-in-scale">
            <div className="text-center max-w-2xl">
              <div className="mb-8">
                <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
                  2025
                </h1>
                <h2 className="text-2xl md:text-4xl font-semibold text-foreground mb-2">Your Trading Year</h2>
                <p className="text-lg text-muted-foreground">Let’s dive into your onchain trading journey</p>
              </div>
              <Button
                onClick={nextStep}
                size="lg"
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
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

        {/* Step 5: Share */}
        {currentStep === 5 && (
          <div className="relative z-10 min-h-screen flex items-center justify-center p-6 animate-slide-in-up">
            <div className="text-center max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold mb-8 text-foreground">Share your stats</h2>

              <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20 mb-8">
                <div className="text-sm text-muted-foreground mb-4">Your 2024 Trading Stats</div>
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <div className="text-xs text-muted-foreground">Invested</div>
                    <div className="text-xl font-semibold text-foreground">{formatUsd(invested)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total PnL</div>
                    <div className={`text-xl font-semibold ${pnl >= 0 ? "text-primary" : "text-destructive"}`}>{formatUsd(pnl)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Realized</div>
                    <div className={`text-xl font-semibold ${realized >= 0 ? "text-primary" : "text-destructive"}`}>{formatUsd(realized)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Unrealized</div>
                    <div className={`text-xl font-semibold ${unrealized >= 0 ? "text-primary" : "text-destructive"}`}>{formatUsd(unrealized)}</div>
                  </div>
                </div>
              </Card>

              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  onClick={() =>
                    openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`)
                  }
                  className="px-6"
                >
                  Share on X/Twitter
                </Button>
                <Button
                  onClick={() =>
                    openShare(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`)
                  }
                  className="px-6"
                >
                  Share on Telegram
                </Button>
                <Button
                  onClick={() => openShare(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`)}
                  className="px-6"
                >
                  Share on LinkedIn
                </Button>
                <Button variant="outline" onClick={copyShareToClipboard} className="px-6">
                  {copied ? "Copied!" : "Copy link"}
                </Button>
              </div>

              <div className="mt-8">
                <Button
                  variant="outline"
                  onClick={restart}
                  className="px-8 py-4 text-lg rounded-full border-primary/20 hover:border-primary/40 bg-transparent"
                >
                  Start over
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Progress indicator */}
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
      </div>
    )
  }

  return (
    <main className="min-h-screen w-full max-w-4xl mx-auto p-6 sm:p-8 lg:p-10 flex flex-col justify-center gap-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4">
          Trading Wrapped 2024
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
            {loading ? "Analyzing your trades..." : "Show me my Trading Wrapped ✨"}
          </Button>
        </form>
      </Card>
    </main>
  )
}
