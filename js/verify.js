/* ============================================
   VERIFY SIGNATURES PAGE JAVASCRIPT
   ============================================
   
   Functions:
   1. Load Test Users AND Enrolled Users from Backend
   2. User Type Toggle (Test Users vs Enrolled Users)
   3. Folder Dropdown with User Selection
   4. Signature Selection within User
   5. New Signature Upload (Drag/Drop)
   6. Verification with Adaptive Thresholds
   7. Threshold Indicator Display
   8. Enrollment Modal
   
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  /* ============================================
       DOM ELEMENTS
       ============================================ */

  const userTypeSelector = document.getElementById("user-type-selector")
  const testUsersBtn = document.getElementById("test-users-btn")
  const enrolledUsersBtn = document.getElementById("enrolled-users-btn")
  const enrollNewBtn = document.getElementById("enroll-new-btn")

  const thresholdIndicator = document.getElementById("threshold-indicator")
  const thresholdType = document.getElementById("threshold-type")
  const thresholdCosine = document.getElementById("threshold-cosine")
  const thresholdEuclidean = document.getElementById("threshold-euclidean")
  const thresholdManhattan = document.getElementById("threshold-manhattan")
  const thresholdToggle = document.getElementById("threshold-toggle")

  const folderSelect = document.getElementById("folder-select")
  const savedSignatureDisplay = document.getElementById("saved-signature-display")
  const savedPreview = document.getElementById("saved-preview")
  const savedEmpty = document.getElementById("saved-empty")
  const dropzoneVerify = document.getElementById("dropzone-verify")
  const fileInputVerify = document.getElementById("file-input-verify")
  const previewVerify = document.getElementById("preview-verify")
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

  // Feature bars and values
  const feature1Bar = document.getElementById("feature1-bar")
  const feature2Bar = document.getElementById("feature2-bar")
  const feature3Bar = document.getElementById("feature3-bar")
  const feature1Value = document.getElementById("feature1-value")
  const feature2Value = document.getElementById("feature2-value")
  const feature3Value = document.getElementById("feature3-value")

  const enrollmentModal = document.getElementById("enrollment-modal")
  const closeModalBtn = document.getElementById("close-modal")
  const enrollUsernameInput = document.getElementById("enroll-username")
  const enrollDropzone = document.getElementById("enroll-dropzone")
  const enrollFileInput = document.getElementById("enroll-file-input")
  const enrollFileList = document.getElementById("enroll-file-list")
  const enrollSubmitBtn = document.getElementById("enroll-submit-btn")
  const enrollStatus = document.getElementById("enroll-status")

  // Store data
  let testUsers = []
  let enrolledUsers = []
  let selectedUser = null
  let selectedSignature = null
  let newSignatureFile = null
  let currentUserType = "test" // 'test' or 'enrolled'
  let enrollmentFiles = []
  let currentThresholds = null
  let useDefaultThreshold = false
  let currentUser = null // Declare the currentUser variable

  const currentLoggedInUser = JSON.parse(sessionStorage.getItem("forgeblock_user"))
  const isAuthenticated = !!currentLoggedInUser

  console.log("[v0] currentLoggedInUser:", currentLoggedInUser)
  console.log("[v0] isAuthenticated:", isAuthenticated)

  // Circle circumference for percentage animation
  const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * 85

  const API_BASE_URL = "http://localhost:8000"

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
       INITIALIZATION
       ============================================ */

  async function initialize() {
    await Promise.all([loadTestUsers(), loadEnrolledUsers(), loadDefaultThresholds()])
    setupUserTypeToggle()
    setupEnrollmentModal()
    setupThresholdToggle()
  }

  initialize()

  /* ============================================
       THRESHOLD INDICATOR
       ============================================ */

  async function loadDefaultThresholds() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/thresholds`)
      if (response.ok) {
        const data = await response.json()
        currentThresholds = data.thresholds
        updateThresholdDisplay(data.thresholds, data.type)
      }
    } catch (error) {
      console.error("Error loading thresholds:", error)
    }
  }

  async function loadUserThresholds(userId, userType) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/thresholds?user_id=${encodeURIComponent(userId)}&user_type=${userType}`,
      )
      if (response.ok) {
        const data = await response.json()
        currentThresholds = data.thresholds
        updateThresholdDisplay(data.thresholds, data.type)
      }
    } catch (error) {
      console.error("Error loading user thresholds:", error)
    }
  }

  function updateThresholdDisplay(thresholds, type) {
    if (!thresholdIndicator) return

    thresholdType.textContent = type === "adaptive" ? "Adaptive" : "Default"
    thresholdType.className = `threshold-type-value ${type}`
    thresholdCosine.textContent = thresholds.cosine.toFixed(4)
    thresholdEuclidean.textContent = thresholds.euclidean.toFixed(4)
    thresholdManhattan.textContent = thresholds.manhattan.toFixed(4)
  }

  /* ============================================
       USER TYPE TOGGLE
       ============================================ */

  function setupUserTypeToggle() {
    if (testUsersBtn) {
      testUsersBtn.addEventListener("click", () => switchUserType("test"))
    }
    if (enrolledUsersBtn) {
      enrolledUsersBtn.addEventListener("click", () => switchUserType("enrolled"))
    }
  }

  function switchUserType(type) {
    currentUserType = type

    if (testUsersBtn && enrolledUsersBtn) {
      testUsersBtn.classList.toggle("active", type === "test")
      enrolledUsersBtn.classList.toggle("active", type === "enrolled")
    }

    if (type === "test") {
      populateFolderDropdown(testUsers, "test")
    } else {
      populateFolderDropdown(enrolledUsers, "enrolled")
    }

    resetSelection()
    loadDefaultThresholds()
  }

  function resetSelection() {
    selectedUser = null
    selectedSignature = null
    savedPreview.style.display = "none"
    savedEmpty.style.display = "block"
    savedEmpty.textContent =
      currentUserType === "test"
        ? "Select a test user to see their signatures"
        : "Select an enrolled user to see their signatures"

    const existingPicker = document.getElementById("signature-picker")
    if (existingPicker) existingPicker.remove()

    updateThresholdToggleVisibility()
    checkVerifyButton()
  }

  /* ============================================
       LOAD USERS FROM BACKEND
       ============================================ */

  async function loadTestUsers() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test-users`)
      if (!response.ok) {
        throw new Error(`Failed to load test users: ${response.status}`)
      }
      const data = await response.json()
      testUsers = data.users
      populateFolderDropdown(testUsers, "test")
    } catch (error) {
      console.error("Error loading test users:", error)
      folderSelect.innerHTML = '<option value="">Error loading users</option>'
    }
  }

  async function loadEnrolledUsers() {
    try {
      let url = `${API_BASE_URL}/api/enrolled-users`

      // If user is logged in, filter by their account
      if (currentLoggedInUser && currentLoggedInUser.email) {
        url += `?account_email=${encodeURIComponent(currentLoggedInUser.email)}`
      }

      console.log("[v0] loadEnrolledUsers URL:", url)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Failed to load enrolled users: ${response.status}`)
      }
      const data = await response.json()

      console.log("[v0] Enrolled users data:", data)

      enrolledUsers = data.users

      if (enrolledUsersBtn && data.total_users > 0) {
        enrolledUsersBtn.textContent = `Enrolled Users (${data.total_users})`
      } else if (enrolledUsersBtn) {
        enrolledUsersBtn.textContent = `Enrolled Users (0)`
      }
    } catch (error) {
      console.error("Error loading enrolled users:", error)
      enrolledUsers = []
      if (enrolledUsersBtn) {
        enrolledUsersBtn.textContent = `Enrolled Users (0)`
      }
    }
  }

  function populateFolderDropdown(users, type) {
    folderSelect.innerHTML = `<option value="">Select ${type === "test" ? "Test" : "Enrolled"} User</option>`

    users.forEach((user) => {
      const option = document.createElement("option")
      option.value = user.user_id
      const count = type === "test" ? user.genuine_count : user.signature_count
      const thresholdBadge = user.has_adaptive_threshold ? " ✓" : ""
      option.textContent = `${user.display_name} (${count} signatures)${thresholdBadge}`
      folderSelect.appendChild(option)
    })
  }

  /* ============================================
       FOLDER SELECTION HANDLER
       ============================================ */

  folderSelect.addEventListener("change", async function () {
    const userId = this.value

    if (userId === "") {
      resetSelection()
      loadDefaultThresholds()
    } else {
      const userList = currentUserType === "test" ? testUsers : enrolledUsers
      selectedUser = userList.find((u) => u.user_id === userId)

      if (selectedUser) {
        createSignaturePicker(selectedUser, currentUserType)
        updateThresholdToggleVisibility()

        if (currentUserType === "enrolled" && selectedUser.has_adaptive_threshold && !useDefaultThreshold) {
          await loadUserThresholds(userId, "enrolled")
        } else {
          await loadDefaultThresholds()
        }
      }
    }

    checkVerifyButton()
  })

  /* ============================================
       CREATE SIGNATURE PICKER UI
       ============================================ */

  function createSignaturePicker(user, type) {
    const existingPicker = document.getElementById("signature-picker")
    if (existingPicker) existingPicker.remove()

    const picker = document.createElement("div")
    picker.id = "signature-picker"
    picker.className = "signature-picker"
    picker.innerHTML = `
      <label class="picker-label">Select a ${type === "test" ? "genuine" : "reference"} signature:</label>
      <div class="signature-thumbnails" id="signature-thumbnails"></div>
    `

    const sectionHeader = folderSelect.parentElement
    sectionHeader.parentElement.insertBefore(picker, savedSignatureDisplay)

    const thumbnailsContainer = document.getElementById("signature-thumbnails")

    user.signatures.forEach((sig, index) => {
      const thumb = document.createElement("div")
      thumb.className = "signature-thumbnail"
      thumb.dataset.path = sig.path
      thumb.dataset.index = index

      const img = document.createElement("img")

      if (type === "enrolled") {
        img.src = `${API_BASE_URL}/api/enrolled-users/${encodeURIComponent(user.user_id)}/signature-image?filename=${encodeURIComponent(sig.filename)}`
      } else {
        img.src = `${API_BASE_URL}/api/signature-image?path=${encodeURIComponent(sig.path)}`
      }

      img.alt = sig.filename
      img.loading = "lazy"

      const label = document.createElement("span")
      label.className = "thumb-label"
      label.textContent = `#${index + 1}`

      thumb.appendChild(img)
      thumb.appendChild(label)
      thumb.addEventListener("click", () => selectSignature(sig, thumb, type))
      thumbnailsContainer.appendChild(thumb)
    })

    savedPreview.style.display = "none"
    savedEmpty.style.display = "block"
    savedEmpty.textContent = "Click a signature above to select it"
    selectedSignature = null
  }

  function selectSignature(signature, thumbElement, type) {
    document.querySelectorAll(".signature-thumbnail").forEach((t) => t.classList.remove("active"))
    thumbElement.classList.add("active")

    selectedSignature = signature

    if (type === "enrolled") {
      savedPreview.src = `${API_BASE_URL}/api/enrolled-users/${encodeURIComponent(selectedUser.user_id)}/signature-image?filename=${encodeURIComponent(signature.filename)}`
    } else {
      savedPreview.src = `${API_BASE_URL}/api/signature-image?path=${encodeURIComponent(signature.path)}`
    }

    savedPreview.style.display = "block"
    savedEmpty.style.display = "none"
    checkVerifyButton()
  }

  /* ============================================
       ENROLLMENT MODAL
       ============================================ */

  function setupEnrollmentModal() {
    if (enrollNewBtn) {
      enrollNewBtn.addEventListener("click", () => {
        // Check if user is authenticated before allowing enrollment
        if (!isAuthenticated) {
          showAuthRequiredMessage()
          return
        }
        openEnrollmentModal()
      })
    }

    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", closeEnrollmentModal)
    }

    if (enrollmentModal) {
      enrollmentModal.addEventListener("click", (e) => {
        if (e.target === enrollmentModal) closeEnrollmentModal()
      })
    }

    if (enrollDropzone) {
      ;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        enrollDropzone.addEventListener(eventName, (e) => {
          e.preventDefault()
          e.stopPropagation()
        })
      })
      ;["dragenter", "dragover"].forEach((eventName) => {
        enrollDropzone.addEventListener(eventName, () => {
          enrollDropzone.classList.add("drag-over")
        })
      })
      ;["dragleave", "drop"].forEach((eventName) => {
        enrollDropzone.addEventListener(eventName, () => {
          enrollDropzone.classList.remove("drag-over")
        })
      })

      enrollDropzone.addEventListener("drop", (e) => {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
        addEnrollmentFiles(files)
      })
    }

    if (enrollFileInput) {
      enrollFileInput.addEventListener("change", (e) => {
        const files = Array.from(e.target.files)
        addEnrollmentFiles(files)
      })
    }

    if (enrollSubmitBtn) {
      enrollSubmitBtn.addEventListener("click", submitEnrollment)
    }
  }

  function openEnrollmentModal() {
    enrollmentFiles = []
    updateEnrollmentFileList()
    if (enrollUsernameInput) enrollUsernameInput.value = ""
    if (enrollStatus) {
      enrollStatus.textContent = ""
      enrollStatus.className = "enroll-status"
    }
    if (enrollmentModal) enrollmentModal.style.display = "flex"
  }

  function closeEnrollmentModal() {
    if (enrollmentModal) enrollmentModal.style.display = "none"
    enrollmentFiles = []
  }

  function addEnrollmentFiles(files) {
    files.forEach((file) => {
      if (!enrollmentFiles.some((f) => f.name === file.name)) {
        enrollmentFiles.push(file)
      }
    })
    updateEnrollmentFileList()
  }

  function removeEnrollmentFile(index) {
    enrollmentFiles.splice(index, 1)
    updateEnrollmentFileList()
  }

  function updateEnrollmentFileList() {
    if (!enrollFileList) return

    if (enrollmentFiles.length === 0) {
      enrollFileList.innerHTML = '<p class="no-files">No files selected</p>'
    } else {
      enrollFileList.innerHTML = enrollmentFiles
        .map(
          (file, index) => `
        <div class="enroll-file-item">
          <span class="file-name">${file.name}</span>
          <button type="button" class="remove-file-btn" data-index="${index}">&times;</button>
        </div>
      `,
        )
        .join("")

      enrollFileList.querySelectorAll(".remove-file-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          removeEnrollmentFile(Number.parseInt(btn.dataset.index))
        })
      })
    }

    if (enrollSubmitBtn) {
      const hasUsername = enrollUsernameInput && enrollUsernameInput.value.trim().length > 0
      enrollSubmitBtn.disabled = enrollmentFiles.length < 5 || !hasUsername
    }

    const countDisplay = document.getElementById("enroll-count")
    if (countDisplay) {
      countDisplay.textContent = `${enrollmentFiles.length}/5 minimum`
      countDisplay.className = enrollmentFiles.length >= 5 ? "count-valid" : "count-invalid"
    }
  }

  if (enrollUsernameInput) {
    enrollUsernameInput.addEventListener("input", updateEnrollmentFileList)
  }

  async function submitEnrollment() {
    const username = enrollUsernameInput?.value.trim()

    if (!username) {
      showEnrollStatus("Please enter a username", "error")
      return
    }

    if (enrollmentFiles.length < 5) {
      showEnrollStatus("Please upload at least 5 signatures", "error")
      return
    }

    if (!currentLoggedInUser || !currentLoggedInUser.email) {
      showEnrollStatus("You must be logged in to enroll users", "error")
      return
    }

    console.log("[v0] Enrolling with account_email:", currentLoggedInUser.email)

    enrollSubmitBtn.disabled = true
    enrollSubmitBtn.textContent = "Enrolling..."
    showEnrollStatus("Processing signatures...", "info")

    try {
      const formData = new FormData()
      formData.append("username", username)
      formData.append("account_email", currentLoggedInUser.email)
      enrollmentFiles.forEach((file) => {
        formData.append("signatures", file)
      })

      const response = await fetch(`${API_BASE_URL}/api/enroll-user`, {
        method: "POST",
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || "Enrollment failed")
      }

      showEnrollStatus(
        `Successfully enrolled "${username}" with adaptive thresholds: 
        Cosine: ${result.adaptive_thresholds.cosine.toFixed(4)}, 
        Euclidean: ${result.adaptive_thresholds.euclidean.toFixed(4)}, 
        Manhattan: ${result.adaptive_thresholds.manhattan.toFixed(4)}`,
        "success",
      )

      await loadEnrolledUsers()

      setTimeout(() => {
        closeEnrollmentModal()
        switchUserType("enrolled")
      }, 2000)
    } catch (error) {
      showEnrollStatus(`Enrollment failed: ${error.message}`, "error")
    } finally {
      enrollSubmitBtn.disabled = false
      enrollSubmitBtn.textContent = "Enroll User"
    }
  }

  function showEnrollStatus(message, type) {
    if (enrollStatus) {
      enrollStatus.textContent = message
      enrollStatus.className = `enroll-status ${type}`
    }
  }

  /* ============================================
       THRESHOLD TOGGLE
       ============================================ */

  function setupThresholdToggle() {
    if (thresholdToggle) {
      thresholdToggle.addEventListener("change", async () => {
        useDefaultThreshold = thresholdToggle.checked

        if (useDefaultThreshold) {
          await loadDefaultThresholds()
        } else if (selectedUser && currentUserType === "enrolled") {
          await loadUserThresholds(selectedUser.user_id, "enrolled")
        } else {
          await loadDefaultThresholds()
        }
      })
    }
  }

  function updateThresholdToggleVisibility() {
    const toggleContainer = document.getElementById("threshold-toggle-container")
    if (toggleContainer) {
      if (currentUserType === "enrolled" && selectedUser && selectedUser.has_adaptive_threshold) {
        toggleContainer.style.display = "flex"
      } else {
        toggleContainer.style.display = "none"
        if (thresholdToggle) {
          thresholdToggle.checked = false
          useDefaultThreshold = false
        }
      }
    }
  }
  /* ============================================
       DROPZONE SETUP
       ============================================ */
  ;["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropzoneVerify.addEventListener(eventName, (e) => {
      e.preventDefault()
      e.stopPropagation()
    })
  })
  ;["dragenter", "dragover"].forEach((eventName) => {
    dropzoneVerify.addEventListener(eventName, () => {
      dropzoneVerify.classList.add("drag-over")
    })
  })
  ;["dragleave", "drop"].forEach((eventName) => {
    dropzoneVerify.addEventListener(eventName, () => {
      dropzoneVerify.classList.remove("drag-over")
    })
  })

  dropzoneVerify.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleNewSignature(files[0])
    }
  })

  fileInputVerify.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleNewSignature(e.target.files[0])
    }
  })

  function handleNewSignature(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file")
      return
    }

    newSignatureFile = file
    dropzoneVerify.classList.add("has-file")

    const reader = new FileReader()
    reader.onload = (e) => {
      previewVerify.src = e.target.result
      previewVerify.style.display = "block"

      const icon = dropzoneVerify.querySelector(".upload-icon")
      const text = dropzoneVerify.querySelector(".dropzone-text")
      const subtext = dropzoneVerify.querySelector(".dropzone-subtext")

      if (icon) icon.style.display = "none"
      if (text) text.style.display = "none"
      if (subtext) subtext.style.display = "none"
    }
    reader.readAsDataURL(file)

    checkVerifyButton()
  }

  function checkVerifyButton() {
    verifyBtn.disabled = !(selectedSignature && newSignatureFile)
  }

  /* ============================================
       MATCH CRITERIA & VERDICT
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

  function getVerdict(percentage, backendVerdict = null) {
    if (backendVerdict !== null) {
      return backendVerdict === "genuine" || backendVerdict === true
        ? { label: "Genuine", class: "genuine" }
        : { label: "Forged", class: "forged" }
    }

    const VERDICT_THRESHOLD = 70
    if (percentage >= VERDICT_THRESHOLD) {
      return { label: "Genuine", class: "genuine" }
    } else {
      return { label: "Forged", class: "forged" }
    }
  }

  /* ============================================
       AI OBSERVATIONS
       ============================================ */

  function generateAIObservations(percentage, features, matchCriteria, thresholdType) {
    const observations = []

    if (thresholdType === "adaptive") {
      observations.push("Using personalized adaptive thresholds for this enrolled user.")
    }

    if (matchCriteria.class === "matched") {
      observations.push("The uploaded signature matches the reference signature with high confidence.")
    } else if (matchCriteria.class === "high-match") {
      observations.push("Strong similarity detected between the signatures.")
    } else if (matchCriteria.class === "low-match") {
      observations.push("Partial similarity found with some variations detected.")
    } else {
      observations.push("The uploaded signature does not match the reference signature.")
    }

    const cos = features.cosineSimilarity
    const euc = features.euclideanDistance
    const man = features.manhattanDistance

    if (cos >= 0.9) {
      observations.push("Vector analysis reveals near-identical directional characteristics.")
    } else if (cos >= 0.7) {
      observations.push("Directional patterns show good alignment.")
    } else if (cos < 0.5) {
      observations.push("Significant directional divergence detected.")
    }

    if (euc <= 0.3) {
      observations.push("Spatial metrics indicate very close alignment.")
    } else if (euc > 0.6) {
      observations.push("Substantial spatial differences present.")
    }

    return observations.join(" ")
  }

  /* ============================================
       VERIFY SIGNATURES
       ============================================ */

  verifyBtn.addEventListener("click", async () => {
    if (!selectedSignature || !newSignatureFile) {
      alert("Please select a reference signature and upload a new one")
      return
    }

    defaultState.style.display = "none"
    resultsState.style.display = "none"
    loadingIndicator.style.display = "block"

    try {
      const formData = new FormData()
      formData.append("signature", newSignatureFile)
      formData.append("user_id", selectedUser.user_id)

      let endpoint
      const refPath = selectedSignature.path
      formData.append("reference_path", refPath)

      if (currentUserType === "enrolled") {
        endpoint = `${API_BASE_URL}/api/verify-enrolled`
        formData.append("use_default_threshold", useDefaultThreshold ? "true" : "false")
      } else {
        endpoint = `${API_BASE_URL}/api/verify-signature`
      }

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API error response:", errorText)
        throw new Error(`API error: ${response.status}`)
      }

      const result = await response.json()
      displayResults(result)
    } catch (error) {
      console.error("Verification error:", error)
      alert(`Error during verification: ${error.message}. Make sure the backend is running on ${API_BASE_URL}`)
      resetAnalysisPanel()
    }
  })

  /* ============================================
       DISPLAY RESULTS
       ============================================ */

  function displayResults(result) {
    loadingIndicator.style.display = "none"
    resultsState.style.display = "block"

    const { matchPercentage, features, verdict, threshold_type, thresholds_used } = result
    const matchCriteria = getMatchCriteria(matchPercentage)
    const finalVerdict = getVerdict(matchPercentage, verdict)

    if (thresholds_used) {
      updateThresholdDisplay(thresholds_used, threshold_type || "default")
    }

    animatePercentage(0, matchPercentage)
    animateCircle(matchPercentage)

    const percentageColor = getPercentageColor(matchPercentage)
    resultPercentage.style.color = percentageColor

    // Update SVG gradient dynamically
    const circleGradient = document.getElementById("circleGradientVerify")
    if (circleGradient) {
      const stops = circleGradient.querySelectorAll("stop")
      if (stops.length >= 2) {
        stops[0].style.stopColor = percentageColor
        stops[1].style.stopColor = percentageColor
      }
    }

    matchLabel.textContent = matchCriteria.label
    matchLabel.className = "match-label " + matchCriteria.class

    verdictLabel.textContent = finalVerdict.label
    verdictLabel.className = "verdict-label " + finalVerdict.class

    setTimeout(() => {
      feature1Value.textContent = features.cosineSimilarity.toFixed(4)
      feature1Bar.style.width = features.cosineSimilarity * 100 + "%"

      const euclideanNormalized = Math.max(0, 1 - features.euclideanDistance)
      feature2Value.textContent = features.euclideanDistance.toFixed(4)
      feature2Bar.style.width = euclideanNormalized * 100 + "%"

      const manhattanMax = 15.0
      const manhattanNormalized = Math.max(0.05, Math.min(1, 1 - features.manhattanDistance / manhattanMax))
      feature3Value.textContent = features.manhattanDistance.toFixed(4)
      feature3Bar.style.width = manhattanNormalized * 100 + "%"
    }, 300)

    const observations = generateAIObservations(matchPercentage, features, matchCriteria, threshold_type)
    observationText.textContent = observations
  }

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

      if (progress < 1) requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }

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
    progressCircle.style.strokeDashoffset = CIRCLE_CIRCUMFERENCE
  }

  /* ============================================
       CHECK AUTHENTICATION
       ============================================ */

  function checkAuthentication() {
    const userDataStr = sessionStorage.getItem("forgeblock_user")
    if (userDataStr) {
      currentUser = JSON.parse(userDataStr)
      return true
    }
    return false
  }

  // Check auth on page load
  checkAuthentication()

  // Update nav profile link with user's first name if logged in
  const navProfileLink = document.querySelector('.nav-link[href="profile.html"]')
  if (navProfileLink && currentUser) {
    const firstName = currentUser.firstName || (currentUser.name ? currentUser.name.split(" ")[0] : null)
    if (firstName) {
      navProfileLink.textContent = firstName
    }
  }

  function showAuthRequiredMessage() {
    // Create and show a modal or alert for auth required
    const authModal = document.createElement("div")
    authModal.className = "modal-overlay"
    authModal.id = "auth-required-modal"
    authModal.style.display = "flex"
    authModal.style.alignItems = "center"
    authModal.style.justifyContent = "center"
    authModal.innerHTML = `
      <div class="modal-content enrollment-modal" style="max-width: 400px; text-align: center; padding: 2rem;">
        <svg style="width: 64px; height: 64px; color: #f59e0b; margin-bottom: 1rem;" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 11H5C3.89543 11 3 11.8954 3 13V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V13C21 11.8954 20.1046 11 19 11Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2 style="color: white; margin-bottom: 0.5rem; font-size: 1.5rem;">Account Required</h2>
        <p style="color: rgba(255,255,255,0.7); margin-bottom: 1.5rem;">Create an account to enroll signatures and access personalized verification features.</p>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <a href="signin.html" style="padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #2f4388, #6389c8); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign In</a>
          <a href="signup.html" style="padding: 0.75rem 1.5rem; background: transparent; border: 1px solid rgba(99,137,200,0.5); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign Up</a>
        </div>
        <button id="close-auth-modal" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 1.5rem;">&times;</button>
      </div>
    `
    document.body.appendChild(authModal)

    // Close button handler
    document.getElementById("close-auth-modal").addEventListener("click", () => {
      authModal.remove()
    })

    // Click outside to close
    authModal.addEventListener("click", (e) => {
      if (e.target === authModal) {
        authModal.remove()
      }
    })
  }
})
