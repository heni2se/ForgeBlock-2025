/* ============================================
   SIGN IN PAGE JAVASCRIPT
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  const signinForm = document.getElementById("signin-form")
  const emailInput = document.getElementById("email")
  const passwordInput = document.getElementById("password")
  const signinError = document.getElementById("signin-error")
  const signinErrorText = document.getElementById("signin-error-text")

  /* ============================================
       CHECK IF USER ALREADY LOGGED IN
       ============================================ */
  const existingUser = sessionStorage.getItem("forgeblock_user")
  if (existingUser) {
    window.location.href = "profile.html"
    return
  }

  /* ============================================
       SHOW/HIDE ERROR MESSAGE
       ============================================ */
  function showError(message) {
    signinErrorText.textContent = message
    signinError.style.display = "flex"
  }

  function hideError() {
    signinError.style.display = "none"
  }

  /* ============================================
       FORM SUBMISSION HANDLER
       ============================================ */

  signinForm.addEventListener("submit", (e) => {
    e.preventDefault()
    hideError()

    const email = emailInput.value.trim()
    const password = passwordInput.value

    // Basic validation
    if (!email || !password) {
      showError("Please fill in all fields")
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      showError("Please enter a valid email address")
      return
    }

    // Get all registered users from localStorage
    const allUsers = JSON.parse(localStorage.getItem("forgeblock_users") || "[]")

    // Find user by email
    const user = allUsers.find((u) => u.email === email)

    if (!user) {
      showError("No account found with this email address")
      return
    }

    // Check password
    if (user.password !== password) {
      showError("Incorrect password. Please try again.")
      return
    }

    // Login successful - save to sessionStorage
    sessionStorage.setItem("forgeblock_user", JSON.stringify(user))

    // Redirect to profile page
    window.location.href = "profile.html"
  })

  // Hide error when user starts typing
  emailInput.addEventListener("input", hideError)
  passwordInput.addEventListener("input", hideError)

  /* ============================================
       SOCIAL LOGIN HANDLERS (Placeholder)
       ============================================ */

  const googleBtn = document.querySelector(".btn-google")
  const facebookBtn = document.querySelector(".btn-facebook")

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      alert("Google Sign-In: Connect to your OAuth backend")
    })
  }

  if (facebookBtn) {
    facebookBtn.addEventListener("click", () => {
      alert("Outlook Sign-In: Connect to your OAuth backend")
    })
  }
})
