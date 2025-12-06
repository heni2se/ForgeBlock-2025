/* ============================================
   PROFILE PAGE JAVASCRIPT
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8000"

  // DOM Elements
  const testUserList = document.getElementById("test-user-list")
  const enrolledUserList = document.getElementById("enrolled-user-list")
  const testUsersSection = document.getElementById("test-users-section")
  const enrolledUsersSection = document.getElementById("enrolled-users-section")
  const previewPlaceholder = document.getElementById("preview-placeholder")
  const previewContent = document.getElementById("preview-content")
  const signaturePreviewLarge = document.getElementById("signature-preview-large")
  const previewUser = document.getElementById("preview-user")
  const previewFilename = document.getElementById("preview-filename")
  const previewType = document.getElementById("preview-type")
  const userTypeBtns = document.querySelectorAll(".user-type-btn")
  const userSearch = document.getElementById("user-search")

  const testUsersStat = document.getElementById("test-users-stat")
  const enrolledUsersStat = document.getElementById("enrolled-users-stat")

  // State
  let currentUserType = "test"
  let testUsers = []
  let enrolledUsers = []
  const expandedUsers = new Set()

  /* ============================================
       USER TYPE SELECTOR
       ============================================ */

  userTypeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type
      currentUserType = type

      userTypeBtns.forEach((b) => b.classList.remove("active"))
      btn.classList.add("active")

      if (type === "test") {
        testUsersSection.style.display = "block"
        enrolledUsersSection.style.display = "none"
      } else {
        testUsersSection.style.display = "none"
        enrolledUsersSection.style.display = "block"
      }

      userSearch.value = ""
      filterUsers("")
    })
  })

  /* ============================================
       SEARCH FUNCTIONALITY
       ============================================ */

  userSearch.addEventListener("input", (e) => {
    filterUsers(e.target.value.toLowerCase())
  })

  function filterUsers(query) {
    const container = currentUserType === "test" ? testUserList : enrolledUserList
    const items = container.querySelectorAll(".user-folder-item")

    items.forEach((item) => {
      const userName = item.dataset.userId.toLowerCase()
      if (userName.includes(query)) {
        item.style.display = "block"
      } else {
        item.style.display = "none"
      }
    })
  }

  /* ============================================
       LOAD USERS FROM BACKEND
       ============================================ */

  async function loadTestUsers() {
    try {
      const response = await fetch(`${API_BASE}/api/test-users`)
      if (!response.ok) throw new Error("Failed to load test users")
      const data = await response.json()
      testUsers = data.users
      renderUserList(testUsers, testUserList, "test")
      updateStats()
    } catch (error) {
      console.error("Error loading test users:", error)
      testUserList.innerHTML = '<p class="empty-state">Failed to load test users</p>'
    }
  }

  async function loadEnrolledUsers() {
    try {
      // Get current logged-in user from sessionStorage
      const currentUser = JSON.parse(sessionStorage.getItem("forgeblock_user"))
      let url = `${API_BASE}/api/enrolled-users`

      // Add account_email filter if user is logged in
      if (currentUser && currentUser.email) {
        url += `?account_email=${encodeURIComponent(currentUser.email)}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to load enrolled users")
      const data = await response.json()
      enrolledUsers = data.users
      renderUserList(enrolledUsers, enrolledUserList, "enrolled")
      updateStats()
    } catch (error) {
      console.error("Error loading enrolled users:", error)
      enrolledUserList.innerHTML = '<p class="empty-state">Failed to load enrolled users</p>'
    }
  }

  /* ============================================
       UPDATE STATS
       ============================================ */

  function updateStats() {
    testUsersStat.querySelector(".stat-value").textContent = testUsers.length
    enrolledUsersStat.querySelector(".stat-value").textContent = enrolledUsers.length
  }

  /* ============================================
       RENDER USER LIST
       ============================================ */

  function renderUserList(users, container, type) {
    container.innerHTML = ""

    if (users.length === 0) {
      container.innerHTML = `<p class="empty-state">No ${type} users found</p>`
      return
    }

    users.forEach((user) => {
      const userId = user.user_id
      const userItem = document.createElement("div")
      userItem.className = "user-folder-item"
      userItem.dataset.userId = userId
      userItem.dataset.type = type

      const isExpanded = expandedUsers.has(`${type}-${userId}`)
      if (isExpanded) userItem.classList.add("expanded")

      const sigCount = user.signature_count || user.signatures?.length || 0

      // Add remove button only for enrolled users
      const removeButton =
        type === "enrolled"
          ? `
        <button class="btn-remove-user" data-user-id="${userId}" data-user-name="${user.display_name || userId}" title="Remove user">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      `
          : ""

      userItem.innerHTML = `
        <div class="user-folder-header" data-user-id="${userId}" data-type="${type}">
          <svg class="chevron-icon ${isExpanded ? "expanded" : ""}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg class="folder-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span class="user-name">${user.display_name || userId}</span>
          <span class="signature-count">${sigCount}</span>
          ${removeButton}
        </div>
        <div class="user-signatures" style="display: ${isExpanded ? "grid" : "none"};">
        </div>
      `

      container.appendChild(userItem)

      const header = userItem.querySelector(".user-folder-header")
      header.addEventListener("click", (e) => {
        // Don't toggle if clicking remove button
        if (e.target.closest(".btn-remove-user")) return
        toggleUserFolder(userId, type, userItem)
      })

      // Add remove button event listener for enrolled users
      if (type === "enrolled") {
        const removeBtn = userItem.querySelector(".btn-remove-user")
        if (removeBtn) {
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation()
            const userName = removeBtn.dataset.userName
            const userId = removeBtn.dataset.userId
            // Call the global function from profile-additions.js
            if (window.showDeleteUserModal) {
              window.showDeleteUserModal(userId, userName)
            }
          })
        }
      }

      if (isExpanded) {
        loadUserSignatures(userId, type, userItem.querySelector(".user-signatures"))
      }
    })
  }

  /* ============================================
       TOGGLE USER FOLDER
       ============================================ */

  async function toggleUserFolder(userId, type, userItem) {
    const key = `${type}-${userId}`
    const signaturesContainer = userItem.querySelector(".user-signatures")
    const chevron = userItem.querySelector(".chevron-icon")

    if (expandedUsers.has(key)) {
      expandedUsers.delete(key)
      signaturesContainer.style.display = "none"
      chevron.classList.remove("expanded")
      userItem.classList.remove("expanded")
    } else {
      expandedUsers.add(key)
      signaturesContainer.style.display = "grid"
      chevron.classList.add("expanded")
      userItem.classList.add("expanded")

      if (signaturesContainer.children.length === 0) {
        await loadUserSignatures(userId, type, signaturesContainer)
      }
    }
  }

  /* ============================================
       LOAD USER SIGNATURES
       ============================================ */

  async function loadUserSignatures(userId, type, container) {
    container.innerHTML = '<p class="loading-text">Loading...</p>'

    try {
      let signatures = []

      if (type === "test") {
        const response = await fetch(`${API_BASE}/api/test-users/${userId}/signatures`)
        if (!response.ok) throw new Error("Failed to load signatures")
        const data = await response.json()
        signatures = data.signatures
      } else {
        const user = enrolledUsers.find((u) => u.user_id === userId)
        if (user && user.signatures) {
          signatures = user.signatures
        }
      }

      renderSignatures(signatures, container, userId, type)
    } catch (error) {
      console.error("Error loading signatures:", error)
      container.innerHTML = '<p class="error-text">Failed to load</p>'
    }
  }

  /* ============================================
       RENDER SIGNATURES
       ============================================ */

  function renderSignatures(signatures, container, userId, type) {
    container.innerHTML = ""

    if (signatures.length === 0) {
      container.innerHTML = '<p class="empty-text">No signatures</p>'
      return
    }

    signatures.forEach((sig) => {
      const sigItem = document.createElement("div")
      sigItem.className = "signature-item"

      let imageUrl
      if (type === "test") {
        imageUrl = `${API_BASE}/api/signature-image?path=${encodeURIComponent(sig.path)}`
      } else {
        imageUrl = `${API_BASE}/api/enrolled-users/${userId}/signature-image?filename=${encodeURIComponent(sig.filename)}`
      }

      sigItem.innerHTML = `
        <div class="signature-thumbnail">
          <img src="${imageUrl}" alt="${sig.filename}">
        </div>
        <span class="signature-filename">${sig.filename}</span>
      `

      sigItem.addEventListener("click", () => {
        selectSignature(imageUrl, userId, sig.filename, type)
        document.querySelectorAll(".signature-item.selected").forEach((item) => {
          item.classList.remove("selected")
        })
        sigItem.classList.add("selected")
      })

      container.appendChild(sigItem)
    })
  }

  /* ============================================
       SELECT SIGNATURE FOR PREVIEW
       ============================================ */

  function selectSignature(imageUrl, userId, filename, type) {
    previewPlaceholder.style.display = "none"
    previewContent.style.display = "flex"

    signaturePreviewLarge.src = imageUrl
    previewUser.textContent = userId
    previewFilename.textContent = filename
    previewType.textContent = type === "test" ? "Test User" : "Enrolled User"
  }

  /* ============================================
       INITIALIZE
       ============================================ */

  loadTestUsers()
  loadEnrolledUsers()
})
