/* ============================================
   COMPARE SIGNATURES PAGE JAVASCRIPT
   ============================================
   
   Functions:
   1. Drag and Drop File Upload
   2. File Input Click Handler
   3. Image Preview
   4. Signature Comparison (calls backend)
   5. Results Display with Circular Percentage
   6. Match Criteria Determination
   7. AI Observations Generation (Rule-based)
   8. Forged/Genuine Verdict Determination
   
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================
       DOM ELEMENTS
       ============================================ */

  const dropzone1 = document.getElementById("dropzone1")
  const dropzone2 = document.getElementById("dropzone2")
  const fileInput1 = document.getElementById("file-input-1")
  const fileInput2 = document.getElementById("file-input-2")
  const preview1 = document.getElementById("preview1")
  const preview2 = document.getElementById("preview2")
  const verifyBtn = document.getElementById("verify-btn")

  // Analysis panel elements
  const loadingIndicator = document.getElementById("loading-indicator")
  const defaultState = document.getElementById("default-state")
  const resultsState = document.getElementById("results-state")

  const resultPercentage = document.getElementById("result-percentage")
  const progressCircle = document.getElementById("progress-circle")
  const matchLabel = document.getElementById("match-label")
  const observationText = document.getElementById("observation-text")
  const verdictLabel = document.getElementById("verdict-label")

  const feature1Bar = document.getElementById("feature1-bar")
  const feature2Bar = document.getElementById("feature2-bar")
  const feature3Bar = document.getElementById("feature3-bar")
  const feature1Value = document.getElementById("feature1-value")
  const feature2Value = document.getElementById("feature2-value")
  const feature3Value = document.getElementById("feature3-value")

  // Store uploaded files
  let signature1File = null
  let signature2File = null

  // Circle circumference for percentage animation (2 * PI * radius)
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 85 // ~534

  const API_BASE_URL = "http://localhost:8000"

  /* ============================================
       DROPZONE SETUP
       ============================================ */

  function setupDropzone(dropzone, fileInput, preview, signatureNum) {
    ;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, preventDefaults, false)
    })

    function preventDefaults(e) {
      e.preventDefault()
      e.stopPropagation()
    }
    ;["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, () => {
        dropzone.classList.add("drag-over")
      })
    })
    ;["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, () => {
        dropzone.classList.remove("drag-over")
      })
    })

    dropzone.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFile(files[0], preview, signatureNum)
      }
    })

    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFile(e.target.files[0], preview, signatureNum)
      }
    })
  }

  function handleFile(file, preview, signatureNum) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    if (signatureNum === 1) {
      signature1File = file
      dropzone1.classList.add("has-file")
    } else {
      signature2File = file
      dropzone2.classList.add("has-file")
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      preview.src = e.target.result
      preview.style.display = "block"

      const dropzone = signatureNum === 1 ? dropzone1 : dropzone2
      const icon = dropzone.querySelector(".upload-icon")
      const text = dropzone.querySelector(".dropzone-text")
      const subtext = dropzone.querySelector(".dropzone-subtext")

      if (icon) icon.style.display = "none"
      if (text) text.style.display = "none"
      if (subtext) subtext.style.display = "none"
    }
    reader.readAsDataURL(file)

    checkVerifyButton()
  }

  function checkVerifyButton() {
    verifyBtn.disabled = !(signature1File && signature2File)
  }

  setupDropzone(dropzone1, fileInput1, preview1, 1)
  setupDropzone(dropzone2, fileInput2, preview2, 2)

  /* ============================================
       CALCULATE MATCH PERCENTAGE FROM METRICS
       ============================================ */

  function calculateMatchPercentage(features) {
    const cosine = features.cosineSimilarity
    const euclidean = features.euclideanDistance
    const manhattan = features.manhattanDistance

    // Normalize Cosine Similarity: already 0-1, higher is better
    const cosineScore = cosine

    // Normalize Euclidean Distance: 0-1 range (lower distance -> higher match)
    const euclideanScore = Math.max(0, Math.min(1, 1 - euclidean / 0.4))

    // Adjusted Manhattan Score normalization (with maxDistance of 12 or 15)
    const manhattanMax = 15.0
    const manhattanScore = Math.max(0, Math.min(1, 1 - manhattan / manhattanMax))

    // Weighted average: give more weight to cosine similarity (it's the most reliable)
    const weightedScore = (cosineScore * 0.4 + euclideanScore * 0.3 + manhattanScore * 0.3) * 100

    return Math.round(Math.min(100, Math.max(0, weightedScore)))
  }

  /* ============================================
       MATCH CRITERIA DETERMINATION
       ============================================ */

  function getMatchCriteria(percentage) {
    if (percentage >= 90) {
      return { label: "Matched", class: "matched" }
    } else if (percentage >= 70) {
      return { label: "High Match", class: "high-match" }
    } else if (percentage >= 50) {
      return { label: "Low Match", class: "low-match" }
    } else {
      return { label: "No Match", class: "no-match" }
    }
  }

  /* ============================================
       FORGED/GENUINE VERDICT DETERMINATION
       ============================================ */

  function getVerdict(percentage, backendVerdict = null) {
    if (backendVerdict !== null) {
      return backendVerdict === "genuine" || backendVerdict === true
        ? { label: "Genuine", class: "genuine" }
        : { label: "Forged", class: "forged" }
    }

    // Fallback to percentage-based verdict
    const VERDICT_THRESHOLD = 60
    if (percentage >= VERDICT_THRESHOLD) {
      return { label: "Genuine", class: "genuine" }
    } else {
      return { label: "Forged", class: "forged" }
    }
  }

  /* ============================================
       AI OBSERVATIONS GENERATION
       ============================================ */

  function generateAIObservations(percentage, features, matchCriteria) {
    const observations = []

    // Overall match observation
    if (matchCriteria.class === "matched") {
      observations.push(
        "The signatures show an exceptionally high degree of similarity, indicating they are very likely from the same individual.",
      )
    } else if (matchCriteria.class === "high-match") {
      observations.push("The signatures demonstrate strong similarity patterns consistent with authentic matching.")
    } else if (matchCriteria.class === "low-match") {
      observations.push(
        "The signatures share some common characteristics but show notable variations that warrant further examination.",
      )
    } else {
      observations.push(
        "The signatures display significant differences, suggesting they may originate from different individuals.",
      )
    }

    // Feature-specific observations based on 3 metrics
    const cosine = features.cosineSimilarity
    const euclidean = features.euclideanDistance
    const manhattan = features.manhattanDistance

    // Cosine similarity observation
    if (cosine >= 0.9) {
      observations.push("Vector analysis reveals near-identical directional characteristics.")
    } else if (cosine >= 0.7) {
      observations.push("Directional patterns show good alignment between signatures.")
    } else if (cosine < 0.5) {
      observations.push("Significant directional divergence detected in signature vectors.")
    }

    // Euclidean distance observation
    if (euclidean <= 0.2) {
      observations.push("Spatial distance metrics indicate very close signature alignment.")
    } else if (euclidean <= 0.5) {
      observations.push("Moderate spatial variations detected in signature positioning.")
    } else {
      observations.push("Substantial spatial differences present between signatures.")
    }

    // Manhattan distance observation
    if (manhattan <= 0.3) {
      observations.push("Path-based distance analysis shows strong consistency.")
    } else if (manhattan > 0.6) {
      observations.push("Significant path variations detected in signature trajectory.")
    }

    // Combine observations
    return observations.join(" ")
  }

  /* ============================================
       GET PERCENTAGE COLOR - Red to Green gradient
       ============================================ */
  function getPercentageColor(percentage) {
    // Red (0%) -> Yellow (50%) -> Green (100%)
    if (percentage <= 50) {
      // Red to Yellow: rgb(239, 68, 68) to rgb(245, 158, 11)
      const ratio = percentage / 50
      const r = Math.round(239 + (245 - 239) * ratio)
      const g = Math.round(68 + (158 - 68) * ratio)
      const b = Math.round(68 + (11 - 68) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    } else {
      // Yellow to Green: rgb(245, 158, 11) to rgb(34, 197, 94)
      const ratio = (percentage - 50) / 50
      const r = Math.round(245 + (34 - 245) * ratio)
      const g = Math.round(158 + (197 - 158) * ratio)
      const b = Math.round(11 + (94 - 11) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    }
  }

  /* ============================================
       VERIFY SIGNATURES - REAL BACKEND INTEGRATION
       ============================================ */

  verifyBtn.addEventListener("click", async () => {
    if (!signature1File || !signature2File) {
      alert("Please upload both signatures")
      return
    }

    // Show loading state
    defaultState.style.display = "none"
    resultsState.style.display = "none"
    loadingIndicator.style.display = "block"

    try {
      const formData = new FormData()
      formData.append("signature1", signature1File)
      formData.append("signature2", signature2File)

      const response = await fetch(`${API_BASE_URL}/api/compare-signatures`, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      displayResults(result)
    } catch (error) {
      console.error("Comparison error:", error)
      alert(`Error during comparison: ${error.message}. Make sure the backend is running on ${API_BASE_URL}`)
      resetAnalysisPanel()
    }
  })

  /**
   * Displays the analysis results with animations
   * @param {Object} result - The analysis result from backend
   */
  function displayResults(result) {
    loadingIndicator.style.display = "none"
    resultsState.style.display = "block"

    const { features, verdict } = result

    const matchPercentage = calculateMatchPercentage(features)
    const matchCriteria = getMatchCriteria(matchPercentage)
    const finalVerdict = getVerdict(matchPercentage, verdict)

    // Animate percentage counter and circle
    animatePercentage(0, matchPercentage)
    animateCircle(matchPercentage)

    const percentageColor = getPercentageColor(matchPercentage)
    resultPercentage.style.color = percentageColor

    // Update SVG gradient dynamically
    const circleGradient = document.getElementById("circleGradient")
    if (circleGradient) {
      const stops = circleGradient.querySelectorAll("stop")
      if (stops.length >= 2) {
        stops[0].style.stopColor = percentageColor
        stops[1].style.stopColor = percentageColor
      }
    }

    // Update match criteria label
    matchLabel.textContent = matchCriteria.label
    matchLabel.className = "match-label " + matchCriteria.class

    verdictLabel.textContent = finalVerdict.label
    verdictLabel.className = "verdict-label " + finalVerdict.class

    // Update feature values and bars
    setTimeout(() => {
      // Feature 1: Cosine Similarity (0-1, higher = better match)
      feature1Value.textContent = features.cosineSimilarity.toFixed(4)
      feature1Bar.style.width = features.cosineSimilarity * 100 + "%"

      // Feature 2: Euclidean Distance (lower = better match, normalize to 0-1 display)
      const euclideanNormalized = Math.max(0, 1 - features.euclideanDistance)
      feature2Value.textContent = features.euclideanDistance.toFixed(4)
      feature2Bar.style.width = euclideanNormalized * 100 + "%"

      // Use a larger max value to ensure bar always shows
      const manhattanMax = 15.0
      const manhattanNormalized = Math.max(0.05, Math.min(1, 1 - features.manhattanDistance / manhattanMax))
      feature3Value.textContent = features.manhattanDistance.toFixed(4)
      feature3Bar.style.width = manhattanNormalized * 100 + "%"
    }, 300)

    // Generate and display AI observations
    const observations = generateAIObservations(matchPercentage, features, matchCriteria)
    observationText.textContent = observations
  }

  /**
   * Animates the percentage counter
   */
  function animatePercentage(start, end) {
    const duration = 1000
    const startTime = performance.now()

    function update(currentTime) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const current = Math.floor(start + (end - start) * progress)

      resultPercentage.textContent = current

      const percentageColor = getPercentageColor(current)
      resultPercentage.style.color = percentageColor

      if (progress < 1) {
        requestAnimationFrame(update)
      }
    }

    requestAnimationFrame(update)
  }

  /**
   * Animates the circular progress indicator
   * @param {number} percentage - Target percentage (0-100)
   */
  function animateCircle(percentage) {
    const offset = CIRCLE_CIRCUMFERENCE - (percentage / 100) * CIRCLE_CIRCUMFERENCE
    progressCircle.style.strokeDashoffset = offset

    const percentageColor = getPercentageColor(percentage)
    progressCircle.style.stroke = percentageColor
  }

  function resetAnalysisPanel() {
    loadingIndicator.style.display = "none"
    resultsState.style.display = "none"
    defaultState.style.display = "block"

    // Reset circle
    progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE
  }
})
