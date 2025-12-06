/* ============================================
   PROFILE PAGE - USER PROFILE MANAGEMENT
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "http://localhost:8000"

  // DOM Elements - Edit Profile
  const btnEditProfile = document.getElementById("btn-edit-profile")
  const editProfileModal = document.getElementById("edit-profile-modal")
  const modalOverlay = document.getElementById("modal-overlay")
  const btnCloseModal = document.getElementById("btn-close-modal")
  const btnCancelEdit = document.getElementById("btn-cancel-edit")
  const editProfileForm = document.getElementById("edit-profile-form")

  // DOM Elements - Logout
  const btnLogout = document.getElementById("btn-logout")
  const logoutModal = document.getElementById("logout-modal")
  const btnCancelLogout = document.getElementById("btn-cancel-logout")
  const btnConfirmLogout = document.getElementById("btn-confirm-logout")

  // DOM Elements - Reports
  const btnNewReport = document.getElementById("btn-new-report")
  const reportModal = document.getElementById("report-modal")
  const btnCloseReportModal = document.getElementById("btn-close-report-modal")
  const btnCancelReport = document.getElementById("btn-cancel-report")
  const btnDownloadReport = document.getElementById("btn-download-report")
  const reportForm = document.getElementById("report-form")
  const forgedReportsList = document.getElementById("forged-reports-list")
  const emptyReportsState = document.getElementById("empty-reports-state")

  // DOM Elements - Delete User
  const deleteUserModal = document.getElementById("delete-user-modal")
  const btnCancelDelete = document.getElementById("btn-cancel-delete")
  const btnConfirmDelete = document.getElementById("btn-confirm-delete")
  const deleteUserName = document.getElementById("delete-user-name")

  // DOM Elements - Locked Overlay
  const lockedOverlay = document.getElementById("locked-overlay")
  const profileMain = document.getElementById("profile-main")

  // Profile display elements
  const profileNameEl = document.getElementById("profile-name")
  const profileEmailEl = document.getElementById("profile-email")
  const profileRoleEl = document.getElementById("profile-role")
  const profileDateJoinedEl = document.getElementById("profile-date-joined")

  // Nav profile link to update with user's first name
  const navProfileLink = document.querySelector('.nav-link[href="profile.html"]')

  // Form inputs - Updated for first name and surname
  const editFirstNameInput = document.getElementById("edit-first-name")
  const editSurnameInput = document.getElementById("edit-surname")
  const editEmailInput = document.getElementById("edit-email")
  const editRoleSelect = document.getElementById("edit-role")

  // State
  let forgedReports = []
  let userToDelete = null
  let editingReportIndex = null
  let currentUser = null

  /* ============================================
       CHECK AUTHENTICATION & SHOW LOCKED OVERLAY
       ============================================ */

  function checkAuthentication() {
    const userDataStr = sessionStorage.getItem("forgeblock_user")

    if (!userDataStr) {
      // User not logged in - show locked overlay
      if (lockedOverlay) {
        lockedOverlay.style.display = "flex"
      }
      if (profileMain) {
        profileMain.style.filter = "blur(8px)"
        profileMain.style.pointerEvents = "none"
      }
      return null
    }

    // User is logged in - hide locked overlay
    if (lockedOverlay) {
      lockedOverlay.style.display = "none"
    }
    if (profileMain) {
      profileMain.style.filter = "none"
      profileMain.style.pointerEvents = "auto"
    }

    return JSON.parse(userDataStr)
  }

  // Check auth on page load
  currentUser = checkAuthentication()

  /* ============================================
       LOAD USER PROFILE
       ============================================ */

  function loadUserProfile() {
    const userDataStr = sessionStorage.getItem("forgeblock_user")

    if (userDataStr) {
      const userData = JSON.parse(userDataStr)
      currentUser = userData

      // Display full name (firstName + surname or legacy name)
      const displayName =
        userData.firstName && userData.surname
          ? `${userData.firstName} ${userData.surname}`
          : userData.name || "User Name"

      profileNameEl.textContent = displayName
      profileEmailEl.textContent = userData.email || "user@email.com"

      // Update nav profile link with user's first name
      if (navProfileLink && (userData.firstName || userData.name)) {
        const firstName = userData.firstName || userData.name.split(" ")[0]
        navProfileLink.textContent = firstName
      }

      if (!userData.role) {
        userData.role = "Staff"
        sessionStorage.setItem("forgeblock_user", JSON.stringify(userData))
      }
      profileRoleEl.textContent = userData.role

      if (userData.dateJoined) {
        const date = new Date(userData.dateJoined)
        profileDateJoinedEl.textContent = date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      } else {
        const today = new Date()
        userData.dateJoined = today.toISOString()
        profileDateJoinedEl.textContent = today.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
        sessionStorage.setItem("forgeblock_user", JSON.stringify(userData))
      }

      return userData
    } else {
      profileNameEl.textContent = "Guest User"
      profileEmailEl.textContent = "guest@forgeblock.ai"
      profileDateJoinedEl.textContent = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      // Reset nav link to "Profile" if no user logged in
      if (navProfileLink) {
        navProfileLink.textContent = "Profile"
      }
    }
  }

  /* ============================================
       EDIT PROFILE MODAL
       ============================================ */

  if (btnEditProfile) {
    btnEditProfile.addEventListener("click", () => {
      const userDataStr = sessionStorage.getItem("forgeblock_user")
      if (userDataStr) {
        const userData = JSON.parse(userDataStr)
        // Populate first name and surname fields
        editFirstNameInput.value = userData.firstName || (userData.name ? userData.name.split(" ")[0] : "")
        editSurnameInput.value = userData.surname || (userData.name ? userData.name.split(" ").slice(1).join(" ") : "")
        editEmailInput.value = userData.email || ""
        editRoleSelect.value = userData.role || "Staff"
      }
      editProfileModal.style.display = "block"
      modalOverlay.style.display = "block"
    })
  }

  function closeEditModal() {
    editProfileModal.style.display = "none"
    modalOverlay.style.display = "none"
  }

  if (btnCloseModal) btnCloseModal.addEventListener("click", closeEditModal)
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeEditModal)
  if (modalOverlay) {
    modalOverlay.addEventListener("click", () => {
      closeEditModal()
      closeLogoutModal()
      closeReportModal()
      closeDeleteModal()
    })
  }

  if (editProfileForm) {
    editProfileForm.addEventListener("submit", (e) => {
      e.preventDefault()

      const firstName = editFirstNameInput.value.trim()
      const surname = editSurnameInput.value.trim()
      const email = editEmailInput.value.trim()
      const role = editRoleSelect.value

      if (!firstName || !surname || !email) {
        alert("Please fill in all fields")
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address")
        return
      }

      const userDataStr = sessionStorage.getItem("forgeblock_user")
      const userData = userDataStr ? JSON.parse(userDataStr) : {}
      const oldEmail = userData.email

      userData.firstName = firstName
      userData.surname = surname
      userData.name = `${firstName} ${surname}`
      userData.email = email
      userData.role = role

      sessionStorage.setItem("forgeblock_user", JSON.stringify(userData))

      // Also update in localStorage users database
      const allUsers = JSON.parse(localStorage.getItem("forgeblock_users") || "[]")
      const userIndex = allUsers.findIndex((u) => u.email === oldEmail)
      if (userIndex >= 0) {
        allUsers[userIndex] = {
          ...allUsers[userIndex],
          firstName,
          surname,
          name: `${firstName} ${surname}`,
          email,
          role,
        }
        localStorage.setItem("forgeblock_users", JSON.stringify(allUsers))
      }

      profileNameEl.textContent = `${firstName} ${surname}`
      profileEmailEl.textContent = email
      profileRoleEl.textContent = role

      // Update nav profile link with new first name
      if (navProfileLink) {
        navProfileLink.textContent = firstName
      }

      currentUser = userData
      closeEditModal()
    })
  }

  /* ============================================
       LOGOUT FUNCTIONALITY
       ============================================ */

  function closeLogoutModal() {
    if (logoutModal) logoutModal.style.display = "none"
    if (modalOverlay) modalOverlay.style.display = "none"
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      logoutModal.style.display = "block"
      modalOverlay.style.display = "block"
    })
  }

  if (btnCancelLogout) {
    btnCancelLogout.addEventListener("click", closeLogoutModal)
  }

  if (btnConfirmLogout) {
    btnConfirmLogout.addEventListener("click", () => {
      // Clear session storage completely
      sessionStorage.removeItem("forgeblock_user")

      // Redirect to home/login page
      window.location.href = "index.html"
    })
  }

  /* ============================================
       FORGED REPORTS MANAGEMENT - USER SPECIFIC
       ============================================ */

  function getUserReportsKey() {
    if (!currentUser || !currentUser.email) return null
    return `forgeblock_reports_${currentUser.email}`
  }

  function loadForgedReports() {
    const reportsKey = getUserReportsKey()
    if (!reportsKey) {
      forgedReports = []
      renderReports()
      return
    }

    const reportsStr = localStorage.getItem(reportsKey)
    if (reportsStr) {
      forgedReports = JSON.parse(reportsStr)
    } else {
      forgedReports = []
    }
    renderReports()
  }

  function saveForgedReports() {
    const reportsKey = getUserReportsKey()
    if (!reportsKey) return

    localStorage.setItem(reportsKey, JSON.stringify(forgedReports))

    // Also update the user's data in the users database
    const allUsers = JSON.parse(localStorage.getItem("forgeblock_users") || "[]")
    const userIndex = allUsers.findIndex((u) => u.email === currentUser.email)
    if (userIndex >= 0) {
      allUsers[userIndex].forgedReports = forgedReports
      localStorage.setItem("forgeblock_users", JSON.stringify(allUsers))
    }
  }

  function renderReports() {
    if (!forgedReportsList || !emptyReportsState) return

    // Clear existing cards first (but not the empty state element)
    const existingCards = forgedReportsList.querySelectorAll(".report-card")
    existingCards.forEach((card) => card.remove())

    if (forgedReports.length === 0) {
      emptyReportsState.style.display = "flex"
      return
    }

    emptyReportsState.style.display = "none"

    // Create new cards using DOM manipulation (fixes delete not working without refresh)
    forgedReports.forEach((report, index) => {
      const reportCard = document.createElement("div")
      reportCard.className = "report-card"
      reportCard.dataset.index = index
      reportCard.innerHTML = `
        <div class="report-info">
          <h4>${report.documentType} - ${report.signerName}</h4>
          <div class="report-meta">
            <span>Date: ${report.dateDetected}</span>
            <span>Score: ${report.matchScore}%</span>
            <span>Action: ${report.action}</span>
          </div>
        </div>
        <div class="report-actions">
          <button class="btn-report-action edit" data-index="${index}">Edit</button>
          <button class="btn-report-action download-pdf" data-index="${index}">PDF</button>
          <button class="btn-report-action delete" data-index="${index}">Delete</button>
        </div>
      `
      forgedReportsList.appendChild(reportCard)

      // Add event listeners directly to the new buttons
      const editBtn = reportCard.querySelector(".btn-report-action.edit")
      const downloadBtn = reportCard.querySelector(".download-pdf")
      const deleteBtn = reportCard.querySelector(".btn-report-action.delete")

      editBtn.addEventListener("click", () => {
        editingReportIndex = index
        openReportModalForEdit(forgedReports[index])
      })

      downloadBtn.addEventListener("click", () => {
        downloadReportPDF(forgedReports[index])
      })

      deleteBtn.addEventListener("click", () => {
        forgedReports.splice(index, 1)
        saveForgedReports()
        renderReports() // Re-render immediately
      })
    })
  }

  function openReportModalForEdit(report) {
    document.getElementById("report-document-type").value = report.documentType || ""
    document.getElementById("report-signer-name").value = report.signerName || ""
    document.getElementById("report-date-detected").value = report.dateDetected || ""
    document.getElementById("report-match-score").value = report.matchScore || ""
    document.getElementById("report-details").value = report.details || ""
    document.getElementById("report-action").value = report.action || "Investigation Required"

    // Update modal header to indicate editing
    const modalHeader = reportModal.querySelector(".modal-header h2")
    if (modalHeader) {
      modalHeader.textContent = "Edit Forgery Report"
    }

    reportModal.style.display = "block"
    modalOverlay.style.display = "block"
  }

  function closeReportModal() {
    if (reportModal) reportModal.style.display = "none"
    if (modalOverlay) modalOverlay.style.display = "none"
    editingReportIndex = null
    // Reset modal header
    const modalHeader = reportModal.querySelector(".modal-header h2")
    if (modalHeader) {
      modalHeader.textContent = "Create Forgery Report"
    }
  }

  if (btnNewReport) {
    btnNewReport.addEventListener("click", () => {
      if (!currentUser) {
        alert("Please sign in to create reports")
        return
      }
      editingReportIndex = null
      reportForm.reset()
      document.getElementById("report-date-detected").valueAsDate = new Date()
      // Reset modal header for new report
      const modalHeader = reportModal.querySelector(".modal-header h2")
      if (modalHeader) {
        modalHeader.textContent = "Create Forgery Report"
      }
      reportModal.style.display = "block"
      modalOverlay.style.display = "block"
    })
  }

  if (btnCloseReportModal) btnCloseReportModal.addEventListener("click", closeReportModal)
  if (btnCancelReport) btnCancelReport.addEventListener("click", closeReportModal)

  if (reportForm) {
    reportForm.addEventListener("submit", (e) => {
      e.preventDefault()

      const report = {
        documentType: document.getElementById("report-document-type").value,
        signerName: document.getElementById("report-signer-name").value,
        dateDetected: document.getElementById("report-date-detected").value,
        matchScore: document.getElementById("report-match-score").value || "N/A",
        details: document.getElementById("report-details").value,
        action: document.getElementById("report-action").value,
        createdAt: new Date().toISOString(),
      }

      if (editingReportIndex !== null) {
        // Update existing report
        forgedReports[editingReportIndex] = report
      } else {
        // Add new report
        forgedReports.push(report)
      }

      saveForgedReports()
      renderReports()
      closeReportModal()
    })
  }

  if (btnDownloadReport) {
    btnDownloadReport.addEventListener("click", () => {
      const report = {
        documentType: document.getElementById("report-document-type").value,
        signerName: document.getElementById("report-signer-name").value,
        dateDetected: document.getElementById("report-date-detected").value,
        matchScore: document.getElementById("report-match-score").value || "N/A",
        details: document.getElementById("report-details").value,
        action: document.getElementById("report-action").value,
        createdAt: new Date().toISOString(),
      }

      if (!report.documentType || !report.signerName || !report.details) {
        alert("Please fill in required fields before downloading")
        return
      }

      downloadReportPDF(report)
    })
  }

  function downloadReportPDF(report) {
    const userData = currentUser || {}

    // Check if jsPDF is loaded
    if (typeof window.jspdf === "undefined") {
      // Fallback to text file if jsPDF not loaded
      downloadReportTXT(report, userData)
      return
    }

    const { jsPDF } = window.jspdf
    const doc = new jsPDF()

    // Colors
    const primaryColor = [47, 67, 136]
    const textColor = [51, 51, 51]
    const lightGray = [128, 128, 128]

    // Header
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, 210, 40, "F")

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text("FORGEBLOCK", 20, 20)

    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text("Signature Forgery Detection Report", 20, 30)

    // Report ID and Date
    doc.setTextColor(...textColor)
    doc.setFontSize(10)
    doc.text(`Report ID: FBR-${Date.now()}`, 20, 50)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 56)
    doc.text(`Generated By: ${userData.name || userData.firstName || "Unknown User"}`, 20, 62)

    // Divider
    doc.setDrawColor(...primaryColor)
    doc.setLineWidth(0.5)
    doc.line(20, 70, 190, 70)

    // Document Information Section
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("DOCUMENT INFORMATION", 20, 82)

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...textColor)

    let yPos = 92
    const lineHeight = 8

    doc.setFont("helvetica", "bold")
    doc.text("Document Type:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(report.documentType, 70, yPos)
    yPos += lineHeight

    doc.setFont("helvetica", "bold")
    doc.text("Alleged Signer:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(report.signerName, 70, yPos)
    yPos += lineHeight

    doc.setFont("helvetica", "bold")
    doc.text("Date Detected:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(report.dateDetected, 70, yPos)
    yPos += lineHeight

    doc.setFont("helvetica", "bold")
    doc.text("Match Score:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(`${report.matchScore}%`, 70, yPos)
    yPos += lineHeight + 5

    // Divider
    doc.line(20, yPos, 190, yPos)
    yPos += 12

    // Analysis Details Section
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("ANALYSIS DETAILS", 20, yPos)
    yPos += 10

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...textColor)

    // Split details into lines
    const detailsLines = doc.splitTextToSize(report.details, 170)
    doc.text(detailsLines, 20, yPos)
    yPos += detailsLines.length * 6 + 10

    // Divider
    doc.line(20, yPos, 190, yPos)
    yPos += 12

    // Recommended Action Section
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...primaryColor)
    doc.text("RECOMMENDED ACTION", 20, yPos)
    yPos += 10

    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(...textColor)
    doc.text(report.action, 20, yPos)

    // Footer
    doc.setFontSize(9)
    doc.setTextColor(...lightGray)
    doc.text("This report was generated by ForgeBlock Signature Verification System", 20, 280)
    doc.text("© 2025 ForgeBlock. All rights reserved.", 20, 286)

    // Save the PDF
    doc.save(`ForgeBlock_Report_${report.signerName.replace(/\s+/g, "_")}_${report.dateDetected}.pdf`)
  }

  // Fallback text file download
  function downloadReportTXT(report, userData) {
    const content = `
FORGEBLOCK SIGNATURE FORGERY REPORT
=====================================

Report ID: FBR-${Date.now()}
Generated: ${new Date().toLocaleString()}
Generated By: ${userData.name || userData.firstName || "Unknown User"}

DOCUMENT INFORMATION
--------------------
Document Type: ${report.documentType}
Alleged Signer: ${report.signerName}
Date Detected: ${report.dateDetected}
Match Score: ${report.matchScore}%

ANALYSIS DETAILS
----------------
${report.details}

RECOMMENDED ACTION
------------------
${report.action}

=====================================
This report was generated by ForgeBlock
Signature Verification System
    `.trim()

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ForgeBlock_Report_${report.signerName.replace(/\s+/g, "_")}_${report.dateDetected}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /* ============================================
       DELETE USER FUNCTIONALITY
       ============================================ */

  function closeDeleteModal() {
    if (deleteUserModal) deleteUserModal.style.display = "none"
    if (modalOverlay) modalOverlay.style.display = "none"
    userToDelete = null
  }

  if (btnCancelDelete) btnCancelDelete.addEventListener("click", closeDeleteModal)

  if (btnConfirmDelete) {
    btnConfirmDelete.addEventListener("click", async () => {
      if (!userToDelete) return

      try {
        const response = await fetch(`${API_BASE}/api/enrolled-users/${encodeURIComponent(userToDelete)}`, {
          method: "DELETE",
        })

        if (response.ok) {
          closeDeleteModal()
          // Trigger reload of enrolled users
          window.location.reload()
        } else {
          alert("Failed to delete user. Please try again.")
        }
      } catch (error) {
        console.error("Error deleting user:", error)
        alert("Error deleting user. Please try again.")
      }
    })
  }

  // Expose the delete modal function globally for profile.js
  window.showDeleteUserModal = (userId, userName) => {
    userToDelete = userId
    if (deleteUserName) deleteUserName.textContent = userName
    if (deleteUserModal) deleteUserModal.style.display = "block"
    if (modalOverlay) modalOverlay.style.display = "block"
  }

  /* ============================================
       INITIALIZE
       ============================================ */

  loadUserProfile()
  loadForgedReports()
})
